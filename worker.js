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

                self.postMessage({ type: 'status', message: `Baixando modelo...` });

                transcriber = await pipeline('automatic-speech-recognition', data.model, {
                    device: data.device,
                    dtype: {
                        encoder_model: 'fp32',
                        decoder_model_merged: 'q4',
                    },
                    progress_callback: (progress) => {
                        if (progress.status === 'initiate') {
                            downloads[progress.file] = { loaded: 0, total: progress.file_size || 0 };
                            self.postMessage({ 
                                type: 'downloads', 
                                downloads: downloads 
                            });
                        }
                        if (progress.status === 'progress' && progress.loaded && progress.total) {
                            downloads[progress.file] = { loaded: progress.loaded, total: progress.total };
                            self.postMessage({ 
                                type: 'downloads', 
                                downloads: downloads 
                            });
                        }
                        if (progress.status === 'done') {
                            delete downloads[progress.file];
                            self.postMessage({ 
                                type: 'downloads', 
                                downloads: downloads 
                            });
                        }
                        if (progress.progress !== undefined) {
                            self.postMessage({ 
                                type: 'progress', 
                                progress: progress.progress / 100 
                            });
                        }
                    }
                });

                self.postMessage({ type: 'ready' });
            } catch (error) {
                console.error('Worker error:', error);
                self.postMessage({ type: 'error', error: error.message + '\n' + (error.stack || '') });
            }
            break;

        case 'transcribe':
            if (!transcriber) {
                self.postMessage({ type: 'error', error: 'Modelo não carregado' });
                return;
            }

            try {
                self.postMessage({ type: 'status', message: `Processando: ${data.filename}` });

                const audioData = data.audio;

                const result = await transcriber(audioData, {
                    chunk_length_s: 30,
                    stride_length_s: 5,
                    return_timestamps: true,
                    language: 'pt',
                    task: 'transcribe',
                });

                let text = result.text;
                text = text.replace(/\[.*?\]/g, '').trim();
                text = text.replace(/\s+/g, ' ').trim();

                self.postMessage({ 
                    type: 'result', 
                    filename: data.filename,
                    text: text,
                    chunks: result.chunks
                });
            } catch (error) {
                console.error('Transcribe error:', error);
                self.postMessage({ 
                    type: 'error', 
                    filename: data.filename,
                    error: error.message 
                });
            }
            break;
    }
};
