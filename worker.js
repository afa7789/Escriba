let transcriber = null;
let downloads = {};

self.onmessage = async function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            try {
                self.postMessage({ type: 'status', message: 'Importando transformers...' });

                const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');

                env.allowLocalModels = false;
                env.useBrowserCache = true;
                env.backends.onnx.wasm.proxy = false;

                self.postMessage({ type: 'status', message: 'Baixando modelo...' });

                const dtype = data.device === 'webgpu'
                    ? { encoder_model: 'fp32', decoder_model_merged: 'fp32' }
                    : { encoder_model: 'fp32', decoder_model_merged: 'q4' };

                transcriber = await pipeline('automatic-speech-recognition', data.model, {
                    device: data.device,
                    dtype,
                    progress_callback: (() => {
                        let lastUpdate = 0;
                        return (progress) => {
                            if (progress.status === 'initiate') {
                                downloads[progress.file] = { loaded: 0, total: progress.file_size || 0 };
                                self.postMessage({ type: 'downloads', downloads });
                            }
                            if (progress.status === 'done') {
                                delete downloads[progress.file];
                                self.postMessage({ type: 'downloads', downloads });
                            }
                            const now = Date.now();
                            if (now - lastUpdate < 500) return;
                            lastUpdate = now;
                            if (progress.status === 'progress' && progress.loaded && progress.total) {
                                downloads[progress.file] = { loaded: progress.loaded, total: progress.total };
                                self.postMessage({ type: 'downloads', downloads });
                            }
                            if (progress.progress !== undefined) {
                                self.postMessage({ type: 'progress', progress: progress.progress / 100 });
                            }
                        };
                    })()
                });

                self.postMessage({ type: 'ready' });
            } catch (error) {
                self.postMessage({ type: 'error', error: error.message + '\n' + (error.stack || '') });
            }
            break;

        case 'transcribe':
            if (!transcriber) {
                self.postMessage({ type: 'error', error: 'Modelo não carregado' });
                return;
            }
            if (!data || !data.filename) {
                self.postMessage({ type: 'error', error: 'Dados inválidos' });
                return;
            }

            try {
                self.postMessage({ type: 'status', message: `Processando: ${data.filename}` });

                const audioData = data.audio;
                const totalSeconds = audioData.length / 16000;

                self.postMessage({
                    type: 'transcribe_info',
                    filename: data.filename,
                    totalSeconds
                });

                const startTime = Date.now();
                const ticker = setInterval(() => {
                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    const min = Math.floor(elapsed / 60);
                    const sec = elapsed % 60;
                    self.postMessage({
                        type: 'transcribe_elapsed',
                        filename: data.filename,
                        elapsed: `${min}:${String(sec).padStart(2, '0')}`
                    });
                }, 3000);

                const transcribeOptions = {
                    chunk_length_s: 30,
                    stride_length_s: 5,
                    return_timestamps: true,
                    task: 'transcribe',
                };
                if (data.language && data.language !== 'auto') {
                    transcribeOptions.language = data.language;
                }

                const result = await transcriber(audioData, transcribeOptions);
                clearInterval(ticker);

                let text = result.text || '';
                text = text.replace(/\[.*?\]/g, '').trim();
                text = text.replace(/\s+/g, ' ').trim();

                self.postMessage({
                    type: 'result',
                    filename: data.filename,
                    text,
                    chunks: result.chunks
                });
            } catch (error) {
                self.postMessage({
                    type: 'error',
                    filename: data.filename,
                    error: error.message
                });
            }
            break;
    }
};
