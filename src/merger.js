/**
 * Merges transcription results from overlapping audio segments.
 * Uses the "core region" principle: each segment's overlap margins are discarded
 * in favor of the adjacent segment's core transcription.
 */

/**
 * Merge ordered segment results into a single transcription string.
 * Each segment result has:
 *   - text: full transcription of the segment (including overlap margins)
 *   - chunks: timestamped chunks from Whisper (optional)
 *   - overlapStartSec: duration of the leading overlap margin in seconds
 *   - overlapEndSec: duration of the trailing overlap margin in seconds
 *   - coreStartSec: start time of the core region relative to segment start
 *   - coreDurationSec: duration of the core region in seconds
 *
 * Strategy: if Whisper provides timestamped chunks, use them to trim overlap.
 * Otherwise, fall back to simple concatenation with word-level dedup.
 *
 * @param {{ text: string, chunks: Array|null, overlapStartSec: number, overlapEndSec: number, segmentDurationSec: number }[]} segmentResults
 * @returns {string}
 */
export function mergeSegments(segmentResults) {
    if (segmentResults.length === 0) return '';
    if (segmentResults.length === 1) return segmentResults[0].text;

    const trimmedTexts = [];

    for (let i = 0; i < segmentResults.length; i++) {
        const seg = segmentResults[i];

        if (seg.chunks && seg.chunks.length > 0) {
            // Use timestamp-based trimming
            const coreStart = seg.overlapStartSec;
            const coreEnd = seg.segmentDurationSec - seg.overlapEndSec;

            const coreChunks = seg.chunks.filter(chunk => {
                if (!chunk.timestamp || chunk.timestamp.length < 2) return true;
                const chunkStart = chunk.timestamp[0];
                const chunkEnd = chunk.timestamp[1];
                if (chunkStart === null || chunkEnd === null) return true;

                // First segment: keep everything up to coreEnd
                if (i === 0) return chunkStart < coreEnd;
                // Last segment: keep everything from coreStart
                if (i === segmentResults.length - 1) return chunkEnd > coreStart;
                // Middle: keep chunks within core region
                return chunkEnd > coreStart && chunkStart < coreEnd;
            });

            trimmedTexts.push(coreChunks.map(c => c.text).join('').trim());
        } else {
            // No chunks — use word-level dedup with previous segment
            trimmedTexts.push(seg.text);
        }
    }

    // Word-level boundary dedup: remove repeated words at segment boundaries
    const merged = [trimmedTexts[0]];
    for (let i = 1; i < trimmedTexts.length; i++) {
        const prevWords = merged[merged.length - 1].split(/\s+/).filter(Boolean);
        const currWords = trimmedTexts[i].split(/\s+/).filter(Boolean);

        // Find overlap: check if the last N words of prev match the first N of curr
        const maxCheck = Math.min(20, prevWords.length, currWords.length);
        let bestOverlap = 0;

        for (let len = 1; len <= maxCheck; len++) {
            const prevTail = prevWords.slice(-len).join(' ').toLowerCase();
            const currHead = currWords.slice(0, len).join(' ').toLowerCase();
            if (prevTail === currHead) {
                bestOverlap = len;
            }
        }

        if (bestOverlap > 0) {
            merged.push(currWords.slice(bestOverlap).join(' '));
        } else {
            merged.push(trimmedTexts[i]);
        }
    }

    return merged.join(' ').replace(/\s+/g, ' ').trim();
}
