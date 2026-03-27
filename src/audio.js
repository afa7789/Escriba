import { state, el } from './state.js';
import { showStatus } from './dom.js';
import { handleFiles } from './files.js';

export const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|flac|m4a|webm|wma|aac|opus)$/i;

export async function prepareAudio(file, audioContext) {
    showStatus(`Decodificando áudio: ${file.name}...`);
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const duration = audioBuffer.duration;

    const targetSampleRate = 16000;
    const outputLength = Math.ceil(duration * targetSampleRate);
    showStatus(`Reamostando áudio: ${file.name} (~${Math.ceil(duration / 60)} min)...`);

    const offlineCtx = new OfflineAudioContext(1, outputLength, targetSampleRate);
    const offlineSource = offlineCtx.createBufferSource();
    const tempBuffer = offlineCtx.createBuffer(1, channelData.length, audioBuffer.sampleRate);
    tempBuffer.copyToChannel(channelData, 0);
    offlineSource.buffer = tempBuffer;
    offlineSource.connect(offlineCtx.destination);
    offlineSource.start();

    const renderedBuffer = await offlineCtx.startRendering();
    return Float32Array.from(renderedBuffer.getChannelData(0));
}

export async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaRecorder = new MediaRecorder(stream);
        state.recordedChunks = [];

        state.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) state.recordedChunks.push(e.data);
        };

        state.mediaRecorder.onstop = () => {
            const blob = new Blob(state.recordedChunks, { type: 'audio/webm' });
            const file = new File([blob], `gravacao-${Date.now()}.webm`, { type: 'audio/webm' });
            handleFiles([file]);
            stream.getTracks().forEach(track => track.stop());
        };

        state.mediaRecorder.start();
        state.recordingStartTime = Date.now();
        el.recordBtn.classList.add('recording');
        el.recordIcon.textContent = '■';
        el.recordText.textContent = 'Parar';

        state.recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const secs = (elapsed % 60).toString().padStart(2, '0');
            el.recordTime.textContent = `${mins}:${secs}`;
        }, 1000);

    } catch (err) {
        showStatus('Erro ao acessar microfone: ' + err.message);
    }
}

export function stopRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
        state.mediaRecorder.stop();
        clearInterval(state.recordingTimer);
        el.recordBtn.classList.remove('recording');
        el.recordIcon.textContent = '●';
        el.recordText.textContent = 'Gravar Áudio';
        el.recordTime.textContent = '';
    }
}
