import { state, el } from './state.js';
import { showStatus, updateProgress, renderDownloads } from './dom.js';
import { updateFileStatus } from './files.js';
import { renderResults, checkComplete } from './results.js';
import { prepareAudio } from './audio.js';
import { splitAtSilence } from './vad.js';
import { mergeSegments } from './merger.js';

const WORKER_URL = new URL('../worker.js', import.meta.url);

// Per-file segment accumulator: { [filename]: { total, received, segments: [] } }
const segmentAccumulator = {};

function handleWorkerMessage(e) {
    const { type, message, error, filename, downloads } = e.data;

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
            break;
        case 'transcribe_elapsed': {
            const elapsedSec = (Date.now() - (state.timings[e.data.filename] || Date.now())) / 1000;
            const audioSec = state.currentAudioSeconds || 1;
            const rtFactor = state.currentDevice === 'webgpu' ? 0.15 : 0.5;
            const estimatedTotalSec = audioSec * rtFactor;
            const progress = Math.min(elapsedSec / estimatedTotalSec, 0.95);
            updateFileStatus(filename, 'processing', progress);
            showStatus(`Transcrevendo: ${filename} — ${e.data.elapsed}`);
            break;
        }
        case 'segment_result': {
            const acc = segmentAccumulator[e.data.filename];
            if (acc) {
                acc.segments[e.data.segmentIndex] = {
                    text: e.data.text,
                    chunks: e.data.chunks,
                    overlapStartSec: e.data.overlapStartSec,
                    overlapEndSec: e.data.overlapEndSec,
                    segmentDurationSec: e.data.segmentDurationSec,
                };
                acc.received++;
                const segProgress = acc.received / acc.total;
                updateFileStatus(e.data.filename, 'processing', segProgress);

                if (acc.received === acc.total) {
                    const merged = mergeSegments(acc.segments);
                    state.results[e.data.filename] = {
                        text: merged,
                        chunks: null,
                        timing: Date.now() - (state.timings[e.data.filename] || Date.now()),
                    };
                    updateFileStatus(e.data.filename, 'done');
                    checkComplete();
                }
            }
            break;
        }
        case 'segment_error': {
            const acc = segmentAccumulator[e.data.filename];
            if (acc) {
                acc.segments[e.data.segmentIndex] = {
                    text: `[erro no segmento ${e.data.segmentIndex + 1}]`,
                    chunks: null,
                    overlapStartSec: 0,
                    overlapEndSec: 0,
                    segmentDurationSec: 0,
                };
                acc.received++;
                if (acc.received === acc.total) {
                    const merged = mergeSegments(acc.segments);
                    state.results[e.data.filename] = {
                        text: merged,
                        chunks: null,
                        timing: Date.now() - (state.timings[e.data.filename] || Date.now()),
                    };
                    updateFileStatus(e.data.filename, 'done');
                    checkComplete();
                }
            }
            break;
        }
        // Legacy compat for single-segment results
        case 'result':
            state.results[filename] = { text: e.data.text, chunks: e.data.chunks, timing: Date.now() - (state.timings[filename] || Date.now()) };
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

    const modelName = el.modelSelect.value;
    const isLargeModel = /medium|large/.test(modelName);
    const maxWorkers = isLargeModel ? 2 : 3;
    const selectedLanguage = el.languageSelect.value;

    // Reuse the pre-loaded main worker as workers[0]
    state.workers.push(state.worker);
    const workerReadyPromises = [];

    // Prepare all audio and build the segment work queue first,
    // so we know how many segments exist before deciding worker count
    const audioContext = new AudioContext();
    const workQueue = []; // { file, segmentIndex, totalSegments, segment }

    showStatus('Analisando áudio e detectando pausas...');

    for (const file of state.selectedFiles) {
        state.timings[file.name] = Date.now();
        updateFileStatus(file.name, 'processing');

        try {
            const audioData = await prepareAudio(file, audioContext);
            const segments = splitAtSilence(audioData);

            segmentAccumulator[file.name] = {
                total: segments.length,
                received: 0,
                segments: new Array(segments.length),
            };

            for (let i = 0; i < segments.length; i++) {
                workQueue.push({
                    file,
                    segmentIndex: i,
                    totalSegments: segments.length,
                    segment: segments[i],
                });
            }

            showStatus(`${file.name}: ${segments.length} segmento(s) detectado(s)`);
        } catch (error) {
            state.results[file.name] = { text: `Erro: ${error.message}`, chunks: null, timing: 0 };
            updateFileStatus(file.name, 'error');
        }
    }

    if (workQueue.length === 0) {
        finishTranscription(audioContext);
        return;
    }

    // Now decide worker count based on actual segment count
    const numWorkers = Math.min(maxWorkers, navigator.hardwareConcurrency || 4, workQueue.length);

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
        showStatus(`Carregando modelo em ${numWorkers} workers...`);
        await Promise.all(workerReadyPromises);
    }
    showStatus(`${numWorkers} worker(s) pronto(s) — ${workQueue.length} segmentos para processar`);

    // Send segment to a worker and wait for its result
    function sendSegmentToWorker(targetWorker, item) {
        const audioMinutes = item.segment.audio.length / 16000 / 60;
        const timeoutMs = Math.max(300000, audioMinutes * 120000);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout: ${item.file.name} seg ${item.segmentIndex}`));
            }, timeoutMs);

            const handler = (e) => {
                if (e.data.filename === item.file.name &&
                    e.data.segmentIndex === item.segmentIndex &&
                    (e.data.type === 'segment_result' || e.data.type === 'segment_error')) {
                    targetWorker.removeEventListener('message', handler);
                    clearTimeout(timeout);
                    resolve();
                }
            };
            targetWorker.addEventListener('message', handler);

            const audioSlice = item.segment.audio;
            targetWorker.postMessage({
                type: 'transcribe',
                data: {
                    filename: item.file.name,
                    audio: audioSlice,
                    language: selectedLanguage,
                    segmentIndex: item.segmentIndex,
                    totalSegments: item.totalSegments,
                    overlapStartSec: item.segment.overlapStartSamples / 16000,
                    overlapEndSec: item.segment.overlapEndSamples / 16000,
                }
            }, [audioSlice.buffer]);
        });
    }

    // Work-stealing across segments
    let nextIdx = 0;
    const totalSegments = workQueue.length;
    let completedSegments = 0;

    async function processNextSegment(workerIndex) {
        while (nextIdx < totalSegments) {
            const idx = nextIdx++;
            const item = workQueue[idx];

            el.progressLabel.textContent = `Segmento ${completedSegments + 1}/${totalSegments}`;
            showStatus(`Worker ${workerIndex + 1}: ${item.file.name} [seg ${item.segmentIndex + 1}/${item.totalSegments}]`);

            try {
                await sendSegmentToWorker(state.workers[workerIndex], item);
                completedSegments++;
                updateProgress(completedSegments / totalSegments);
            } catch (error) {
                const acc = segmentAccumulator[item.file.name];
                if (acc) {
                    acc.segments[item.segmentIndex] = {
                        text: `[erro: ${error.message}]`,
                        chunks: null,
                        overlapStartSec: 0,
                        overlapEndSec: 0,
                        segmentDurationSec: 0,
                    };
                    acc.received++;
                    if (acc.received === acc.total) {
                        const merged = mergeSegments(acc.segments);
                        state.results[item.file.name] = { text: merged, chunks: null, timing: Date.now() - (state.timings[item.file.name] || Date.now()) };
                        updateFileStatus(item.file.name, 'done');
                        checkComplete();
                    }
                }
                completedSegments++;
            }
        }
    }

    const parallelJobs = [];
    for (let i = 0; i < numWorkers; i++) {
        parallelJobs.push(processNextSegment(i));
    }

    const totalAudioMinutes = state.selectedFiles.reduce((acc, f) => acc + ((f.duration || 0) / 60), 0);
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

    finishTranscription(audioContext);
}

async function finishTranscription(audioContext) {
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

    // Clean up accumulators
    for (const key of Object.keys(segmentAccumulator)) {
        delete segmentAccumulator[key];
    }
}
