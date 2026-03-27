/**
 * Energy-based Voice Activity Detection (VAD).
 * Finds silence boundaries in 16kHz Float32Array audio for splitting.
 */

const SAMPLE_RATE = 16000;

/**
 * Compute RMS energy for a window of samples.
 */
function rmsEnergy(samples, start, length) {
    let sum = 0;
    const end = Math.min(start + length, samples.length);
    const count = end - start;
    if (count <= 0) return 0;
    for (let i = start; i < end; i++) {
        sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / count);
}

/**
 * Detect silence boundaries in audio data.
 * Returns an array of { start, end } sample indices representing silence regions.
 *
 * @param {Float32Array} audio - 16kHz mono audio samples
 * @param {Object} opts
 * @param {number} opts.frameDurationMs - Analysis frame size in ms (default 30)
 * @param {number} opts.silenceThreshold - RMS threshold below which a frame is "silent" (default 0.01)
 * @param {number} opts.minSilenceDurationMs - Minimum silence duration to count as a boundary (default 300)
 * @returns {{ start: number, end: number }[]} Silence regions as sample indices
 */
export function detectSilence(audio, opts = {}) {
    const {
        frameDurationMs = 30,
        silenceThreshold = 0.01,
        minSilenceDurationMs = 300,
    } = opts;

    const frameSize = Math.floor(SAMPLE_RATE * frameDurationMs / 1000);
    const minSilenceFrames = Math.ceil(minSilenceDurationMs / frameDurationMs);
    const silences = [];

    let silenceStart = -1;
    let silenceFrameCount = 0;

    for (let offset = 0; offset < audio.length; offset += frameSize) {
        const energy = rmsEnergy(audio, offset, frameSize);

        if (energy < silenceThreshold) {
            if (silenceStart === -1) silenceStart = offset;
            silenceFrameCount++;
        } else {
            if (silenceFrameCount >= minSilenceFrames) {
                silences.push({
                    start: silenceStart,
                    end: offset,
                });
            }
            silenceStart = -1;
            silenceFrameCount = 0;
        }
    }

    // Trailing silence
    if (silenceFrameCount >= minSilenceFrames) {
        silences.push({
            start: silenceStart,
            end: audio.length,
        });
    }

    return silences;
}

/**
 * Split audio into segments at silence boundaries.
 * Each segment is between minSegmentSec and maxSegmentSec long.
 * Adds overlapSec margin on each side for context.
 *
 * @param {Float32Array} audio - 16kHz mono audio
 * @param {Object} opts
 * @param {number} opts.minSegmentSec - Minimum segment duration (default 30)
 * @param {number} opts.maxSegmentSec - Maximum segment duration (default 120)
 * @param {number} opts.overlapSec - Overlap margin on each side (default 3)
 * @returns {{ audio: Float32Array, startSample: number, endSample: number, overlapStartSamples: number, overlapEndSamples: number }[]}
 */
export function splitAtSilence(audio, opts = {}) {
    const {
        minSegmentSec = 30,
        maxSegmentSec = 120,
        overlapSec = 3,
    } = opts;

    const totalSamples = audio.length;
    const totalDuration = totalSamples / SAMPLE_RATE;

    // Short audio — no splitting needed
    if (totalDuration <= maxSegmentSec) {
        return [{
            audio,
            startSample: 0,
            endSample: totalSamples,
            overlapStartSamples: 0,
            overlapEndSamples: 0,
        }];
    }

    const silences = detectSilence(audio);
    const minSamples = minSegmentSec * SAMPLE_RATE;
    const maxSamples = maxSegmentSec * SAMPLE_RATE;
    const overlapSamples = Math.floor(overlapSec * SAMPLE_RATE);

    const cutPoints = [0]; // Start of audio
    let lastCut = 0;

    for (const silence of silences) {
        const silenceMid = Math.floor((silence.start + silence.end) / 2);
        const distFromLastCut = silenceMid - lastCut;

        if (distFromLastCut >= minSamples) {
            cutPoints.push(silenceMid);
            lastCut = silenceMid;
        }
    }

    // Force cuts if any segment exceeds maxSegmentSec
    const finalCuts = [0];
    for (let i = 1; i < cutPoints.length; i++) {
        const segLen = cutPoints[i] - finalCuts[finalCuts.length - 1];
        if (segLen > maxSamples) {
            // Insert intermediate cuts at maxSamples intervals
            let pos = finalCuts[finalCuts.length - 1];
            while (cutPoints[i] - pos > maxSamples) {
                pos += maxSamples;
                finalCuts.push(pos);
            }
        }
        finalCuts.push(cutPoints[i]);
    }

    // Add end of audio if not already there
    if (finalCuts[finalCuts.length - 1] < totalSamples) {
        // Merge tiny trailing segments
        const lastSegLen = totalSamples - finalCuts[finalCuts.length - 1];
        if (lastSegLen < minSamples && finalCuts.length > 1) {
            finalCuts.pop(); // Merge with previous segment
        }
        finalCuts.push(totalSamples);
    }

    // Build segments with overlap margins
    const segments = [];
    for (let i = 0; i < finalCuts.length - 1; i++) {
        const coreStart = finalCuts[i];
        const coreEnd = finalCuts[i + 1];

        const marginStart = Math.max(0, coreStart - overlapSamples);
        const marginEnd = Math.min(totalSamples, coreEnd + overlapSamples);

        const overlapStartActual = coreStart - marginStart;
        const overlapEndActual = marginEnd - coreEnd;

        segments.push({
            audio: audio.slice(marginStart, marginEnd),
            startSample: coreStart,
            endSample: coreEnd,
            overlapStartSamples: overlapStartActual,
            overlapEndSamples: overlapEndActual,
        });
    }

    return segments;
}
