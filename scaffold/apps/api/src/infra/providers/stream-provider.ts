import type { MediaType } from '../../core/types';

export interface StreamCandidate {
  provider: string;
  quality: '720p' | '1080p' | '2160p';
  codec: 'h264' | 'h265' | 'av1';
  sizeBytes: number;
  audioLanguages: string[];
  subtitleLanguages: string[];
  resolveToken: string;
}

export interface StreamProvider {
  readonly name: string;
  findCandidates(input: { tmdbId: number; mediaType: MediaType }): Promise<StreamCandidate[]>;
  resolveDirectUrl(resolveToken: string): Promise<{ url: string; expiresAt: string }>;
}
