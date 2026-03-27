# Escriba

A local browser-based audio transcription tool that runs entirely in your browser using Whisper (ONNX) with WebGPU or WASM acceleration.

## Features

- **100% Local Processing** - All transcription happens in your browser, no server uploads
- **GPU Acceleration** - Uses WebGPU for faster transcription when available
- **Multiple Model Sizes** - Choose between Tiny, Base, or Small Whisper models
- **Batch Processing** - Transcribe multiple audio files at once
- **Export Options** - Download individual text files or ZIP of all transcriptions
- **Audio Recording** - Record directly from microphone and transcribe instantly
- **Cross-Platform** - Works in any modern browser with WebGPU or WebAssembly support

## Usage

1. Open the page in a browser (Chrome, Edge, or other WebGPU-enabled browsers recommended)
2. Select your preferred Whisper model
3. Upload audio files (MP3, WAV, OGG, FLAC, M4A)
4. Click "Transcrever" to start transcription
5. Copy or download results

## Live Demo

Visit: [https://afa7789.github.io/Escriba/](https://afa7789.github.io/escriba/)

## Tech Stack

- [Whisper ONNX](https://huggingface.co/onnx-community/whisper) - Speech recognition models
- Transformers.js - Running Hugging Face models in the browser
- WebGPU / WebAssembly - Hardware acceleration
- Vanilla JavaScript - No build step required
