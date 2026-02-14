import type { ContentType } from '@giraffe/shared';

export interface DebridSource {
  id: string;
  filename: string;
  fileSize: number;
  hash: string;
  cached: boolean;
}

export interface ResolvedStreamResult {
  streamUrl: string;
  expiresAt: Date;
}

export interface DebridProvider {
  name: string;

  /** Search for available sources for a given piece of content */
  searchContent(
    query: string,
    tmdbId: number,
    type: ContentType,
    season?: number,
    episode?: number,
  ): Promise<DebridSource[]>;

  /** Resolve a debrid source to a direct streaming URL */
  resolveSource(sourceId: string): Promise<ResolvedStreamResult>;

  /** Check which hashes are instantly available in the debrid cache */
  checkCacheStatus(hashes: string[]): Promise<Map<string, boolean>>;
}
