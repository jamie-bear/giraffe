import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCandidates } from '../src/modules/streaming/ranking.js';

test('rankCandidates prefers quality + codec + language', () => {
  const ranked = rankCandidates([
    { quality: '720p', codec: 'h264', sizeBytes: 4_000_000_000, audioLanguages: ['en'] },
    { quality: '2160p', codec: 'h265', sizeBytes: 10_000_000_000, audioLanguages: ['en'] },
    { quality: '1080p', codec: 'av1', sizeBytes: 3_000_000_000, audioLanguages: ['fr'] },
  ], 'en');

  assert.equal(ranked[0].quality, '2160p');
});
