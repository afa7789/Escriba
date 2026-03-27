import { state, el } from './state.js';
import { showStatus } from './dom.js';

export function renderResults() {
    el.resultsList.innerHTML = '';
    let totalChars = 0;
    let totalTime = 0;

    const entries = Object.entries(state.results);

    if (entries.length > 1) {
        const copyAllTop = document.createElement('div');
        copyAllTop.className = 'copy-all-container';
        const btn = document.createElement('button');
        btn.className = 'result-btn';
        btn.textContent = 'Copiar Todos';
        btn.addEventListener('click', copyAllTranscriptions);
        copyAllTop.appendChild(btn);
        el.resultsList.appendChild(copyAllTop);
    }

    entries.forEach(([filename, data]) => {
        const isError = data.text.startsWith('Erro:');
        totalChars += isError ? 0 : data.text.length;
        totalTime += data.timing || 0;

        const item = document.createElement('div');
        item.className = 'result-item';

        const header = document.createElement('div');
        header.className = 'result-header';

        const filenameDiv = document.createElement('div');
        filenameDiv.className = 'result-filename';
        filenameDiv.textContent = filename;

        const actions = document.createElement('div');
        actions.className = 'result-actions';

        const dlBtn = document.createElement('button');
        dlBtn.className = 'result-btn';
        dlBtn.textContent = 'Baixar';
        dlBtn.addEventListener('click', () => downloadFile(filename));

        const cpBtn = document.createElement('button');
        cpBtn.className = 'result-btn btn-secondary';
        cpBtn.textContent = 'Copiar';
        cpBtn.addEventListener('click', () => copyToClipboard(filename));

        actions.appendChild(dlBtn);
        actions.appendChild(cpBtn);
        header.appendChild(filenameDiv);
        header.appendChild(actions);

        const textDiv = document.createElement('div');
        textDiv.className = 'result-text';
        textDiv.textContent = data.text;

        item.appendChild(header);
        item.appendChild(textDiv);
        el.resultsList.appendChild(item);
    });

    if (entries.length > 1) {
        const copyAllBottom = document.createElement('div');
        copyAllBottom.className = 'copy-all-container';
        copyAllBottom.style.marginTop = '12px';
        const btn = document.createElement('button');
        btn.className = 'result-btn';
        btn.textContent = 'Copiar Todos';
        btn.addEventListener('click', copyAllTranscriptions);
        copyAllBottom.appendChild(btn);
        el.resultsList.appendChild(copyAllBottom);
    }

    const avgTime = entries.length > 0 ? totalTime / entries.length : 0;

    el.statsDiv.innerHTML = `
        <div class="stats-row">
            <span class="stats-label">Arquivos:</span>
            <span class="stats-value">${entries.length}</span>
        </div>
        <div class="stats-row">
            <span class="stats-label">Caracteres:</span>
            <span class="stats-value">${totalChars.toLocaleString()}</span>
        </div>
        <div class="perf-stats">
            <div class="perf-stat">
                <div class="perf-stat-value">${state.currentDevice.toUpperCase()}</div>
                <div class="perf-stat-label">Backend</div>
            </div>
            <div class="perf-stat">
                <div class="perf-stat-value">${avgTime > 0 ? (avgTime / 1000).toFixed(1) + 's' : '-'}</div>
                <div class="perf-stat-label">Tempo médio</div>
            </div>
            <div class="perf-stat">
                <div class="perf-stat-value">${entries.length}</div>
                <div class="perf-stat-label">Processados</div>
            </div>
            <div class="perf-stat">
                <div class="perf-stat-value">${totalTime > 0 ? (totalTime / 1000).toFixed(1) + 's' : '-'}</div>
                <div class="perf-stat-label">Tempo total</div>
            </div>
        </div>
    `;

    el.resultsContainer.classList.add('active');
}

export function checkComplete() {
    if (Object.keys(state.results).length === state.selectedFiles.length) {
        renderResults();
    }
}

function downloadFile(filename) {
    const data = state.results[filename];
    if (!data) return;
    const blob = new Blob([data.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/\.[^/.]+$/, '')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyToClipboard(filename) {
    const data = state.results[filename];
    if (!data) return;
    navigator.clipboard.writeText(data.text).then(() => {
        showStatus('Copiado para a área de transferência!');
    }).catch(() => {
        showStatus('Erro ao copiar. Selecione o texto manualmente.');
    });
}

function copyAllTranscriptions() {
    const allText = Object.entries(state.results).map(([filename, data]) => {
        return `=== ${filename} ===\n${data.text}`;
    }).join('\n\n');
    navigator.clipboard.writeText(allText).then(() => {
        showStatus('Todas as transcrições copiadas!');
    }).catch(() => {
        showStatus('Erro ao copiar. Selecione o texto manualmente.');
    });
}

export async function downloadAll() {
    if (Object.keys(state.results).length === 0) {
        showStatus('Nenhuma transcrição disponível para baixar.');
        return;
    }
    try {
        const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
        const zip = new JSZip();

        Object.entries(state.results).forEach(([filename, data]) => {
            zip.file(`${filename.replace(/\.[^/.]+$/, '')}.txt`, data.text);
        });

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcricoes-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('ZIP baixado com sucesso!');
    } catch (err) {
        showStatus('Erro ao baixar ZIP: ' + err.message);
    }
}
