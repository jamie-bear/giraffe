const codecWeight = { av1: 30, h265: 20, h264: 10 };
const qualityWeight = { '2160p': 40, '1080p': 25, '720p': 10 };

export function scoreCandidate(candidate, preferredLanguage) {
  const languageBonus = candidate.audioLanguages.includes(preferredLanguage) ? 15 : 0;
  const compactnessBonus = candidate.sizeBytes < 6_000_000_000 ? 8 : 0;
  return qualityWeight[candidate.quality] + codecWeight[candidate.codec] + languageBonus + compactnessBonus;
}

export function rankCandidates(candidates, preferredLanguage) {
  return [...candidates].sort((a, b) => scoreCandidate(b, preferredLanguage) - scoreCandidate(a, preferredLanguage));
}
