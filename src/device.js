import { state, el } from './state.js';
import { initWorker, loadModel } from './transcriber.js';

export async function detectDevice() {
    if (navigator.gpu) {
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) state.webgpuSupported = true;
        } catch { /* WebGPU not available */ }
    }

    if (state.webgpuSupported) {
        state.currentDevice = 'webgpu';
    } else {
        state.currentDevice = 'wasm';
        el.badgeWebgpu.classList.add('disabled');
        el.badgeWebgpu.title = 'WebGPU não suportado neste navegador';
    }
    updateBadges();
}

export function updateBadges() {
    el.badgeWasm.classList.toggle('active', state.currentDevice === 'wasm');
    el.badgeWebgpu.classList.toggle('active', state.currentDevice === 'webgpu');
}

export function setDevice(device) {
    if (device === 'webgpu' && !state.webgpuSupported) return;
    if (device === state.currentDevice) return;
    if (state.isTranscribing) return;
    state.currentDevice = device;
    updateBadges();
    if (state.worker) {
        state.worker.terminate();
        state.worker = null;
    }
    state.isReady = false;
    initWorker();
    loadModel();
}
