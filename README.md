# Escriba

A local browser-based audio transcription tool that runs entirely in your browser using Whisper (ONNX) with WebGPU or WASM acceleration.

## Features

- **100% Local Processing** - All transcription happens in your browser, no server uploads
- **GPU Acceleration** - Uses WebGPU for faster transcription when available, with automatic WASM fallback
- **Voice Activity Detection** - Smart silence detection for optimal audio segmentation
- **Multi-Worker Processing** - Parallel transcription using up to 3 workers for faster processing
- **Text Post-Processing** - Automatically removes repeated sentences, words, and bracketed content
- **Multiple Model Sizes** - Choose between Tiny, Base, Small, or Medium (English) Whisper models
- **Language Selection** - Support for Portuguese, English, Spanish, French, German, Italian, Japanese, Chinese, Korean, plus auto-detect
- **Batch Processing** - Transcribe multiple audio files at once
- **Audio Recording** - Record directly from microphone and transcribe instantly
- **Export Options** - Download individual text files, ZIP of all transcriptions, or copy to clipboard
- **Performance Stats** - View processing time per file and total
- **Cross-Platform** - Works in any modern browser with WebGPU or WebAssembly support

## Usage

1. Open the page in a browser (Chrome, Edge, or other WebGPU-enabled browsers recommended)
2. Select your preferred Whisper model (Tiny, Base, Small, or Medium.en)
3. Choose your language or use auto-detect
4. Upload audio files or record directly from microphone
5. Click "Transcrever" to start transcription
6. Copy or download results

## Live Demo

Visit: [https://afa7789.github.io/Escriba/](https://afa7789.github.io/escriba/)

## Available Models

| Model | Size | Languages | Default |
|-------|------|-----------|---------|
| Tiny | 39MB | Multi | |
| Base | 74MB | Multi | Yes |
| Small | 241MB | Multi | |
| Medium.en | 769MB | English only | |

## Supported Languages

Portuguese, English, Spanish, French, German, Italian, Japanese, Chinese, Korean, or auto-detect.

## Tech Stack

- [Whisper ONNX](https://huggingface.co/onnx-community/whisper) - Speech recognition models
- [Transformers.js](https://huggingface.co/docs/transformers.js) - Running Hugging Face models in the browser
- WebGPU / WebAssembly - Hardware acceleration
- Vanilla JavaScript - No build step required

## Development

```bash
npm install     # Install dependencies
npm run serve  # Start local server
npm run lint   # Run ESLint
npm test       # Run tests
```

Or use the Makefile:

```bash
make install   # Install dependencies
make serve     # Start local server
make lint      # Run ESLint
make lint-fix  # Auto-fix lint issues
make test      # Run tests
```

## Project Structure

```
Escriba/
├── index.html        # Main HTML page
├── styles.css        # CSS with light/dark theme
├── worker.js         # Web Worker for Whisper transcription
├── package.json      # Dependencies and scripts
├── src/
│   ├── app.js        # Main application logic
│   ├── state.js      # Global state management
│   ├── transcriber.js # Transcription orchestration
│   ├── audio.js      # Audio recording & preprocessing
│   ├── files.js      # File handling & UI
│   ├── device.js     # WebGPU/WASM detection
│   ├── dom.js        # DOM utilities
│   ├── results.js    # Results display & download
│   ├── vad.js        # Voice Activity Detection
│   └── merger.js     # Segment merging
└── tests/            # Test files
```
