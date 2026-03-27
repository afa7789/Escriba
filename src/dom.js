import { el } from './state.js';

export function showStatus(message) {
    el.status.textContent = message;
    el.status.classList.add('active');
}

export function clearStatus() {
    el.status.classList.remove('active');
    el.status.textContent = '';
}

export function updateProgress(progress) {
    const percent = Math.round(progress * 100);
    el.progressFill.style.width = percent + '%';
    el.progressPercent.textContent = percent + '%';
}

export function renderDownloads(downloads) {
    const entries = Object.entries(downloads);
    if (entries.length === 0) {
        el.downloadsList.innerHTML = '';
        return;
    }
    el.downloadsList.innerHTML = '';
    entries.forEach(([file, data]) => {
        const name = file.split('/').pop();
        const loaded = (data.loaded / 1024 / 1024).toFixed(1);
        const total = (data.total / 1024 / 1024).toFixed(1);
        const pct = data.total > 0 ? Math.round(data.loaded / data.total * 100) : 0;

        const item = document.createElement('div');
        item.className = 'download-item';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'download-name';
        nameSpan.title = file;
        nameSpan.textContent = name;
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'download-size';
        sizeSpan.textContent = `${loaded} / ${total} MB (${pct}%)`;
        item.appendChild(nameSpan);
        item.appendChild(sizeSpan);
        el.downloadsList.appendChild(item);
    });
}
