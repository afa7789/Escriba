import { expect } from '@esm-bundle/chai';
import { state, initElements } from '../src/state.js';

// Setup minimal DOM for file tests
function setupDOM() {
    document.body.innerHTML = `
        <div id="filesList" class="files-list"></div>
        <div id="status"></div>
        <button id="transcribeBtn" disabled></button>
        <button id="downloadAllBtn" disabled></button>
        <button id="clearBtn"></button>
        <div id="uploadArea"></div>
        <input type="file" id="fileInput">
        <div id="progressContainer"></div>
        <div id="progressFill"></div>
        <span id="progressPercent"></span>
        <span id="progressLabel"></span>
        <div id="downloadsList"></div>
        <select id="modelSelect"></select>
        <select id="languageSelect"></select>
        <div id="resultsContainer"></div>
        <div id="resultsList"></div>
        <div id="stats"></div>
        <div id="badgeWasm"></div>
        <div id="badgeWebgpu"></div>
        <button id="recordBtn"></button>
        <span id="recordIcon"></span>
        <span id="recordText"></span>
        <span id="recordTime"></span>
    `;
    initElements();
}

describe('files module', () => {
    beforeEach(() => {
        setupDOM();
        state.selectedFiles = [];
        state.results = {};
        state.isReady = true;
    });

    it('should import handleFiles without error', async () => {
        const { handleFiles } = await import('../src/files.js');
        expect(handleFiles).to.be.a('function');
    });

    it('should filter non-audio files', async () => {
        const { handleFiles } = await import('../src/files.js');
        const files = [
            new File([''], 'test.txt', { type: 'text/plain' }),
        ];
        handleFiles(files);
        expect(state.selectedFiles.length).to.equal(0);
    });

    it('should accept audio files by MIME type', async () => {
        const { handleFiles } = await import('../src/files.js');
        const files = [
            new File(['audio-data'], 'test.mp3', { type: 'audio/mpeg' }),
        ];
        await handleFiles(files);
        expect(state.selectedFiles.length).to.equal(1);
        expect(state.selectedFiles[0].name).to.equal('test.mp3');
    });

    it('should accept audio files by extension fallback', async () => {
        const { handleFiles } = await import('../src/files.js');
        const files = [
            new File(['audio-data'], 'test.m4a', { type: '' }),
        ];
        await handleFiles(files);
        expect(state.selectedFiles.length).to.equal(1);
    });

    it('should deduplicate files by name + size', async () => {
        const { handleFiles } = await import('../src/files.js');
        const file = new File(['audio-data'], 'test.mp3', { type: 'audio/mpeg' });
        await handleFiles([file]);
        await handleFiles([file]);
        expect(state.selectedFiles.length).to.equal(1);
    });

    it('should accumulate files across calls', async () => {
        const { handleFiles } = await import('../src/files.js');
        await handleFiles([new File(['a'], 'a.mp3', { type: 'audio/mpeg' })]);
        await handleFiles([new File(['b'], 'b.mp3', { type: 'audio/mpeg' })]);
        expect(state.selectedFiles.length).to.equal(2);
    });
});
