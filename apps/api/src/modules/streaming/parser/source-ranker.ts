import {
  QUALITY_SCORES,
  SOURCE_SCORES,
  CODEC_SCORES,
} from '@giraffe/shared';
import type { StreamSource } from '@giraffe/shared';

// Maximum file size thresholds by quality tier (in bytes)
const SIZE_THRESHOLDS: Record<string, number> = {
  '2160p': 80 * 1024 * 1024 * 1024, // 80 GB
  '1080p': 20 * 1024 * 1024 * 1024, // 20 GB
  '720p': 8 * 1024 * 1024 * 1024,   // 8 GB
  '480p': 4 * 1024 * 1024 * 1024,   // 4 GB
};

function scoreSize(quality: string, fileSize: number): number {
  const threshold = SIZE_THRESHOLDS[quality] ?? SIZE_THRESHOLDS['1080p'];
  // Lower file size relative to quality is better (more efficient encoding)
  // Max 15 points
  const ratio = fileSize / threshold;
  if (ratio <= 0.3) return 15; // Very efficient
  if (ratio <= 0.5) return 12;
  if (ratio <= 0.7) return 9;
  if (ratio <= 1.0) return 6;
  return 3; // Over threshold
}

function scoreAvailability(cached: boolean): number {
  return cached ? 15 : 5;
}

function scoreLanguage(languages: string[], preferredLanguage: string): number {
  if (languages.length === 0) return 3; // Unknown, assume ok
  if (languages.some((l) => l.toLowerCase() === preferredLanguage.toLowerCase())) return 5;
  if (languages.some((l) => l.toLowerCase() === 'english')) return 3;
  return 1;
}

export function rankSources(
  sources: StreamSource[],
  preferredLanguage: string = 'en',
): StreamSource[] {
  const scored = sources.map((source) => {
    const qualityScore = QUALITY_SCORES[source.quality] ?? 0;
    const sourceScore = SOURCE_SCORES[source.sourceType] ?? 0;
    const codecScore = CODEC_SCORES[source.codec] ?? 0;
    const sizeScore = scoreSize(source.quality, source.fileSize);
    const availScore = scoreAvailability(source.cached);
    const langScore = scoreLanguage(source.languages, preferredLanguage);

    const totalScore = qualityScore + sourceScore + sizeScore + availScore + codecScore + langScore;

    return { ...source, score: totalScore };
  });

  return scored.sort((a, b) => b.score - a.score);
}
