import { state, el } from './state.js';
import { clearStatus, showStatus } from './dom.js';
import { AUDIO_EXTENSIONS } from './audio.js';

export function handleFiles(files) {
    const audioFiles = Array.from(files).filter(f =>
        f.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(f.name)
    );

    if (audioFiles.length === 0) {
        showStatus('Selecione arquivos de áudio válidos.');
        return;
    }

    for (const file of audioFiles) {
        const isDuplicate = state.selectedFiles.some(
            existing => existing.name === file.name && existing.size === file.size
        );
        if (!isDuplicate) state.selectedFiles.push(file);
    }

    renderFilesList();
    el.transcribeBtn.disabled = !state.isReady;
    clearStatus();
}

export function renderFilesList() {
    el.filesList.innerHTML = '';
    state.selectedFiles.forEach((file) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
        const item = document.createElement('div');
        item.className = 'file-item';
        item.id = `file-${safeName}`;

        const info = document.createElement('div');
        info.className = 'file-item-info';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'file-item-name';
        nameDiv.textContent = file.name;
        const sizeDiv = document.createElement('div');
        sizeDiv.className = 'file-item-size';
        sizeDiv.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
        info.appendChild(nameDiv);
        info.appendChild(sizeDiv);

        const statusDiv = document.createElement('div');
        statusDiv.className = 'file-item-status';
        statusDiv.id = `status-${safeName}`;
        const existingResult = state.results[file.name];
        statusDiv.textContent = existingResult
            ? (existingResult.text.startsWith('Erro:') ? '✗' : '✓')
            : '○';

        const progressDiv = document.createElement('div');
        progressDiv.className = 'file-progress';
        const progressFillDiv = document.createElement('div');
        progressFillDiv.className = 'file-progress-fill';
        progressFillDiv.id = `progress-${safeName}`;
        progressDiv.appendChild(progressFillDiv);

        item.appendChild(info);
        item.appendChild(statusDiv);
        item.appendChild(progressDiv);
        el.filesList.appendChild(item);
    });
    el.filesList.classList.add('active');
}

export function updateFileStatus(filename, statusValue) {
    const safeName = filename.replace(/[^a-zA-Z0-9]/g, '_');
    const statusEl = document.getElementById(`status-${safeName}`);
    const progressEl = document.getElementById(`progress-${safeName}`);
    if (statusEl) {
        statusEl.textContent = statusValue === 'done' ? '✓' : statusValue === 'error' ? '✗' : '...';
    }
    if (progressEl) {
        progressEl.style.width = statusValue === 'done' ? '100%' : statusValue === 'processing' ? '5%' : '0%';
    }
}
