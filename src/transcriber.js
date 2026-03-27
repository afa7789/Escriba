import { state, el } from './state.js';
import { showStatus, updateProgress, renderDownloads } from './dom.js';
import { updateFileStatus } from './files.js';
import { renderResults, checkComplete } from './results.js';
import { prepareAudio } from './audio.js';

const WORKER_URL = new URL('../worker.js', import.meta.url);

function handleWorkerMessage(e) {
    const { type, message, error, filename, text, chunks, downloads } = e.data;

    switch (type) {
        case 'status':
            showStatus(message);
            break;
        case 'progress':
            updateProgress(e.data.progress);
            break;
        case 'downloads':
            renderDownloads(downloads);
            break;
        case 'ready':
            state.isReady = true;
            showStatus('Pronto - Modelo carregado');
            el.progressContainer.classList.remove('active');
            el.downloadsList.innerHTML = '';
            el.transcribeBtn.disabled = state.selectedFiles.length === 0;
            break;
        case 'transcribe_info':
            state.currentAudioSeconds = e.data.totalSeconds;
            showStatus(`Transcrevendo: ${filename} (~${Math.ceil(e.data.totalSeconds / 60)} min de áudio)`);
            break;
        case 'transcribe_elapsed': {
            const elapsedSec = (Date.now() - (state.timings[e.data.filename] || Date.now())) / 1000;
            const audioSec = state.currentAudioSeconds || 1;
            const estimatedTotalSec = Math.max(audioSec * 0.1, audioSec * 0.03);
            const progress = Math.min(elapsedSec / estimatedTotalSec, 0.95);
            updateProgress(progress);
            showStatus(`Transcrevendo: ${filename} — ${e.data.elapsed} (~${Math.round(progress * 100)}%)`);
            break;
        }
        case 'result':
            state.results[filename] = { text, chunks, timing: Date.now() - (state.timings[filename] || Date.now()) };
            updateFileStatus(filename, 'done');
            checkComplete();
            break;
        case 'error':
            state.results[filename || 'unknown'] = { text: `Erro: ${error}`, chunks: null, timing: 0 };
            updateFileStatus(filename || 'unknown', 'error');
            checkComplete();
            break;
    }
}

export function initWorker() {
    state.worker = new Worker(WORKER_URL, { type: 'module' });
    state.worker.onmessage = handleWorkerMessage;
    state.worker.onerror = (e) => {
        showStatus(`Erro no worker: ${e.message}`);
        el.progressContainer.classList.remove('active');
        el.transcribeBtn.disabled = false;
    };
}

export function loadModel() {
    state.isReady = false;
    el.transcribeBtn.disabled = true;
    el.progressContainer.classList.add('active');
    updateProgress(0);
    el.progressLabel.textContent = 'Baixando modelo...';
    showStatus('Iniciando modelo...');

    state.worker.postMessage({
        type: 'init',
        data: {
            model: el.modelSelect.value,
            device: state.currentDevice
        }
    });
}

export async function startTranscription() {
    if (state.selectedFiles.length === 0 || !state.isReady) return;
    if (state.isTranscribing) return;
    state.isTranscribing = true;

    el.transcribeBtn.disabled = true;
    el.downloadAllBtn.disabled = true;
    el.modelSelect.disabled = true;
    el.languageSelect.disabled = true;
    el.progressContainer.classList.add('active');
    el.resultsContainer.classList.remove('active');
    state.results = {};
    el.badgeWasm.classList.add('disabled');
    el.badgeWebgpu.classList.add('disabled');

    state.workers.forEach(w => w.terminate());
    state.workers = [];

    const numWorkers = Math.min(navigator.hardwareConcurrency || 4, state.selectedFiles.length);
    const selectedLanguage = el.languageSelect.value;

    // Reuse the pre-loaded main worker as workers[0]
    state.workers.push(state.worker);
    const workerReadyPromises = [];

    for (let i = 1; i < numWorkers; i++) {
        const w = new Worker(WORKER_URL, { type: 'module' });
        w.onmessage = handleWorkerMessage;
        state.workers.push(w);

        const readyPromise = new Promise((resolve) => {
            const handler = (e) => {
                if (e.data.type === 'ready') {
                    w.removeEventListener('message', handler);
                    resolve();
                }
            };
            w.addEventListener('message', handler);
            w.postMessage({
                type: 'init',
                data: {
                    model: el.modelSelect.value,
                    device: state.currentDevice
                }
            });
        });
        workerReadyPromises.push(readyPromise);
    }

    if (workerReadyPromises.length > 0) {
        showStatus('Carregando modelos...');
        await Promise.all(workerReadyPromises);
    }
    showStatus('Modelos prontos!');

    const audioContext = new AudioContext();

    async function sendToWorker(targetWorker, file, audioData) {
        const audioMinutes = audioData.length / 16000 / 60;
        const timeoutMs = Math.max(300000, audioMinutes * 120000);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout: ' + file.name));
            }, timeoutMs);

            const handler = (e) => {
                if (e.data.filename === file.name && (e.data.type === 'result' || e.data.type === 'error')) {
                    targetWorker.removeEventListener('message', handler);
                    clearTimeout(timeout);
                    resolve();
                }
            };
            targetWorker.addEventListener('message', handler);

            targetWorker.postMessage({
                type: 'transcribe',
                data: {
                    filename: file.name,
                    audio: audioData,
                    language: selectedLanguage
                }
            }, [audioData.buffer]);
        });
    }

    const totalFiles = state.selectedFiles.length;
    let completedFiles = 0;
    let nextFileIndex = 0;

    async function processNextFile(myWorkerIndex) {
        while (nextFileIndex < totalFiles) {
            const fileIdx = nextFileIndex;
            const file = state.selectedFiles[nextFileIndex];
            nextFileIndex++;

            showStatus(`Processando ${fileIdx + 1}/${totalFiles}: ${file.name}`);
            el.progressLabel.textContent = `Arquivo ${completedFiles + 1}/${totalFiles}`;
            updateFileStatus(file.name, 'processing');
            state.timings[file.name] = Date.now();

            try {
                const audioData = await prepareAudio(file, audioContext);
                await sendToWorker(state.workers[myWorkerIndex], file, audioData);
                completedFiles++;
                updateProgress(completedFiles / totalFiles);
            } catch (error) {
                state.results[file.name] = { text: `Erro: ${error.message}`, chunks: null, timing: 0 };
                updateFileStatus(file.name, 'error');
                showStatus(`Erro: ${file.name} - ${error.message}`);
            }
        }
    }

    const parallelJobs = [];
    for (let i = 0; i < numWorkers; i++) {
        parallelJobs.push(processNextFile(i));
    }

    const totalAudioMinutes = state.selectedFiles.reduce((acc, f) => acc + (f.size / 1024 / 1024), 0) * 2;
    const globalTimeoutMs = Math.max(600000, totalAudioMinutes * 120000);
    let globalTimer;
    const timeoutPromise = new Promise((_, reject) =>
        globalTimer = setTimeout(() => reject(new Error('Timeout: processamento took too long')), globalTimeoutMs)
    );

    try {
        await Promise.race([Promise.all(parallelJobs), timeoutPromise]);
    } catch (error) {
        showStatus('Erro no processamento: ' + error.message);
    } finally {
        clearTimeout(globalTimer);
    }

    // Terminate only extra workers, keep main worker alive
    for (let i = 1; i < state.workers.length; i++) {
        state.workers[i].terminate();
    }
    state.workers = [];

    await audioContext.close();
    renderResults();
    showStatus('Concluído.');
    el.downloadAllBtn.disabled = false;
    el.transcribeBtn.disabled = false;
    el.modelSelect.disabled = false;
    el.languageSelect.disabled = false;
    el.progressContainer.classList.remove('active');
    state.isTranscribing = false;
    el.badgeWasm.classList.remove('disabled');
    el.badgeWebgpu.classList.remove('disabled');
    if (!state.webgpuSupported) el.badgeWebgpu.classList.add('disabled');
}
