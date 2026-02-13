import type { StreamProvider } from '../../infra/providers/stream-provider';
import type { MediaType } from '../../core/types';
import { rankCandidates } from './stream-ranking.service';

export class StreamingService {
  constructor(private readonly provider: StreamProvider) {}

  async resolveBestSource(input: { tmdbId: number; mediaType: MediaType; preferredLanguage: string }) {
    const candidates = await this.provider.findCandidates({ tmdbId: input.tmdbId, mediaType: input.mediaType });
    const ranked = rankCandidates(candidates, input.preferredLanguage);
    const top = ranked[0];

    if (!top) throw new Error('No stream candidates available');

    const direct = await this.provider.resolveDirectUrl(top.resolveToken);
    return { selected: top, direct };
  }
}
