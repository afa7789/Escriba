import { expect } from '@esm-bundle/chai';
import { state } from '../src/state.js';

describe('state', () => {
    it('should have correct initial values', () => {
        expect(state.worker).to.equal(null);
        expect(state.workers).to.deep.equal([]);
        expect(state.selectedFiles).to.deep.equal([]);
        expect(state.results).to.deep.equal({});
        expect(state.isReady).to.equal(false);
        expect(state.currentDevice).to.equal('wasm');
        expect(state.isTranscribing).to.equal(false);
        expect(state.webgpuSupported).to.equal(false);
    });

    it('should allow mutation of state properties', () => {
        state.isReady = true;
        expect(state.isReady).to.equal(true);
        state.isReady = false;

        state.currentDevice = 'webgpu';
        expect(state.currentDevice).to.equal('webgpu');
        state.currentDevice = 'wasm';
    });

    it('should allow adding to selectedFiles', () => {
        const originalLength = state.selectedFiles.length;
        state.selectedFiles.push({ name: 'test.mp3', size: 1024 });
        expect(state.selectedFiles.length).to.equal(originalLength + 1);
        state.selectedFiles.pop();
    });

    it('should allow setting results by filename key', () => {
        state.results['test.mp3'] = { text: 'hello', chunks: null, timing: 100 };
        expect(state.results['test.mp3'].text).to.equal('hello');
        delete state.results['test.mp3'];
    });
});
