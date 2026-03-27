import { state, el, initElements } from './state.js';
import { clearStatus } from './dom.js';
import { detectDevice, setDevice } from './device.js';
import { handleFiles } from './files.js';
import { startRecording, stopRecording } from './audio.js';
import { initWorker, loadModel, startTranscription } from './transcriber.js';
import { downloadAll } from './results.js';

initElements();

// Device badges
el.badgeWasm.addEventListener('click', () => setDevice('wasm'));
el.badgeWebgpu.addEventListener('click', () => setDevice('webgpu'));

// Model/language change
el.modelSelect.addEventListener('change', () => {
    if (state.isReady && !state.isTranscribing) loadModel();
});

// File upload
el.uploadArea.addEventListener('click', () => el.fileInput.click());
el.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.uploadArea.classList.add('dragover');
});
el.uploadArea.addEventListener('dragleave', () => {
    el.uploadArea.classList.remove('dragover');
});
el.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    el.uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});
el.fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// Recording
el.recordBtn.addEventListener('click', async () => {
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        await startRecording();
    }
});

// Transcription
el.transcribeBtn.addEventListener('click', () => startTranscription());

// Download ZIP
el.downloadAllBtn.addEventListener('click', () => downloadAll());

// Clear
el.clearBtn.addEventListener('click', () => {
    state.selectedFiles = [];
    state.results = {};
    state.timings = {};
    el.fileInput.value = '';
    el.filesList.classList.remove('active');
    el.resultsContainer.classList.remove('active');
    el.transcribeBtn.disabled = true;
    el.downloadAllBtn.disabled = true;
    clearStatus();
    el.progressContainer.classList.remove('active');
});

// Init
detectDevice().then(() => {
    initWorker();
    loadModel();
});
