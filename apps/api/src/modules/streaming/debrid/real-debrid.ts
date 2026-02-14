import type { ContentType } from '@giraffe/shared';
import type { DebridProvider, DebridSource, ResolvedStreamResult } from './debrid.interface.js';
import { ExternalServiceError } from '../../../utils/errors.js';

const RD_BASE = 'https://api.real-debrid.com/rest/1.0';

export class RealDebridProvider implements DebridProvider {
  name = 'real-debrid';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async rdFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${RD_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ExternalServiceError(
        'Real-Debrid',
        `Real-Debrid API error: ${response.status} ${body}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async searchContent(
    query: string,
    _tmdbId: number,
    _type: ContentType,
    _season?: number,
    _episode?: number,
  ): Promise<DebridSource[]> {
    // Real-Debrid doesn't have a search API directly.
    // In practice, you'd integrate with a torrent indexer/API (e.g., Torrentio, Jackett)
    // to get magnet links, then check availability on Real-Debrid.
    // For MVP, this returns an empty array — the streaming service will integrate
    // with a torrent source provider that returns magnets, which are then checked here.

    // Placeholder: In a real implementation, this would query a torrent indexer
    // and then check instant availability via Real-Debrid.
    return [];
  }

  async resolveSource(magnetOrLink: string): Promise<ResolvedStreamResult> {
    // Step 1: Add magnet link
    const addResult = await this.rdFetch<{ id: string; uri: string }>('/torrents/addMagnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `magnet=${encodeURIComponent(magnetOrLink)}`,
    });

    // Step 2: Select all files
    await this.rdFetch(`/torrents/selectFiles/${addResult.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'files=all',
    });

    // Step 3: Get torrent info with links
    const info = await this.rdFetch<{ links: string[] }>(`/torrents/info/${addResult.id}`);

    if (!info.links || info.links.length === 0) {
      throw new ExternalServiceError('Real-Debrid', 'No links available for this torrent');
    }

    // Step 4: Unrestrict the first link to get direct download URL
    const unrestricted = await this.rdFetch<{ download: string }>('/unrestrict/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `link=${encodeURIComponent(info.links[0])}`,
    });

    return {
      streamUrl: unrestricted.download,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // ~6 hours
    };
  }

  async checkCacheStatus(hashes: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();

    if (hashes.length === 0) return result;

    // Real-Debrid instant availability endpoint accepts up to 200 hashes
    const hashString = hashes.join('/');
    const data = await this.rdFetch<Record<string, unknown>>(
      `/torrents/instantAvailability/${hashString}`,
    );

    for (const hash of hashes) {
      const entry = data[hash.toLowerCase()];
      // If the hash key exists and has data, it's cached
      result.set(hash, entry != null && typeof entry === 'object' && Object.keys(entry as object).length > 0);
    }

    return result;
  }
}
