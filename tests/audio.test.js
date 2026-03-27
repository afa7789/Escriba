import { expect } from '@esm-bundle/chai';
import { AUDIO_EXTENSIONS } from '../src/audio.js';

describe('AUDIO_EXTENSIONS', () => {
    const validExtensions = [
        'test.mp3', 'test.wav', 'test.ogg', 'test.flac',
        'test.m4a', 'test.webm', 'test.wma', 'test.aac', 'test.opus',
    ];

    const invalidExtensions = [
        'test.txt', 'test.pdf', 'test.jpg', 'test.mp4',
        'test.doc', 'test.zip', 'test.js',
    ];

    validExtensions.forEach((name) => {
        it(`should match audio file: ${name}`, () => {
            expect(AUDIO_EXTENSIONS.test(name)).to.equal(true);
        });
    });

    invalidExtensions.forEach((name) => {
        it(`should not match non-audio file: ${name}`, () => {
            expect(AUDIO_EXTENSIONS.test(name)).to.equal(false);
        });
    });

    it('should be case-insensitive', () => {
        expect(AUDIO_EXTENSIONS.test('test.MP3')).to.equal(true);
        expect(AUDIO_EXTENSIONS.test('test.Wav')).to.equal(true);
        expect(AUDIO_EXTENSIONS.test('test.FLAC')).to.equal(true);
    });
});
