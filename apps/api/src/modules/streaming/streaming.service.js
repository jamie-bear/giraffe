import { rankCandidates } from './ranking.js';

function fakeSources(tmdbId) {
  return [
    { id: `${tmdbId}-a`, quality: '1080p', codec: 'h264', sizeBytes: 4_000_000_000, audioLanguages: ['en'], subtitleLanguages: ['en', 'es'], url: `https://stream.giraffe.watch/${tmdbId}/1080` },
    { id: `${tmdbId}-b`, quality: '2160p', codec: 'h265', sizeBytes: 12_000_000_000, audioLanguages: ['en', 'fr'], subtitleLanguages: ['en'], url: `https://stream.giraffe.watch/${tmdbId}/2160` },
    { id: `${tmdbId}-c`, quality: '720p', codec: 'av1', sizeBytes: 2_500_000_000, audioLanguages: ['en'], subtitleLanguages: ['en', 'pt'], url: `https://stream.giraffe.watch/${tmdbId}/720` },
  ];
}

export class StreamingService {
  resolveBestSource({ tmdbId, preferredLanguage }) {
    const ranked = rankCandidates(fakeSources(tmdbId), preferredLanguage);
    const selected = ranked[0];
    return { url: selected.url, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), selectedQuality: selected.quality, selected };
  }

  listSources({ tmdbId, preferredLanguage }) {
    return rankCandidates(fakeSources(tmdbId), preferredLanguage);
  }
}
