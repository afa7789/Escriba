export const state = {
    worker: null,
    workers: [],
    selectedFiles: [],
    results: {},
    isReady: false,
    currentDevice: 'wasm',
    timings: {},
    isTranscribing: false,
    mediaRecorder: null,
    recordedChunks: [],
    recordingStartTime: null,
    recordingTimer: null,
    webgpuSupported: false,
};

export const el = {};

export function initElements() {
    el.uploadArea = document.getElementById('uploadArea');
    el.fileInput = document.getElementById('fileInput');
    el.filesList = document.getElementById('filesList');
    el.transcribeBtn = document.getElementById('transcribeBtn');
    el.downloadAllBtn = document.getElementById('downloadAllBtn');
    el.clearBtn = document.getElementById('clearBtn');
    el.status = document.getElementById('status');
    el.progressContainer = document.getElementById('progressContainer');
    el.progressFill = document.getElementById('progressFill');
    el.progressPercent = document.getElementById('progressPercent');
    el.progressLabel = document.getElementById('progressLabel');
    el.downloadsList = document.getElementById('downloadsList');
    el.modelSelect = document.getElementById('modelSelect');
    el.languageSelect = document.getElementById('languageSelect');
    el.resultsContainer = document.getElementById('resultsContainer');
    el.resultsList = document.getElementById('resultsList');
    el.statsDiv = document.getElementById('stats');
    el.badgeWasm = document.getElementById('badgeWasm');
    el.badgeWebgpu = document.getElementById('badgeWebgpu');
    el.recordBtn = document.getElementById('recordBtn');
    el.recordIcon = document.getElementById('recordIcon');
    el.recordText = document.getElementById('recordText');
    el.recordTime = document.getElementById('recordTime');
}
