import type { ContentType } from '@giraffe/shared';
import type { DebridProvider, DebridSource, ResolvedStreamResult } from './debrid.interface.js';
import { ExternalServiceError } from '../../../utils/errors.js';
import { searchTorrentio } from '../torrentio.client.js';
import { getExternalIds } from '../../metadata/tmdb.client.js';

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
    _query: string,
    tmdbId: number,
    type: ContentType,
    season?: number,
    episode?: number,
  ): Promise<DebridSource[]> {
    // Step 1: Get IMDB ID from TMDB (Torrentio uses IMDB IDs)
    const externalIds = await getExternalIds(type === 'movie' ? 'movie' : 'tv', tmdbId);
    if (!externalIds.imdb_id) {
      console.warn(`No IMDB ID found for TMDB ${type} ${tmdbId}`);
      return [];
    }

    // Step 2: Search Torrentio for available torrents
    const torrentioType = type === 'movie' ? 'movie' : 'series';
    const torrents = await searchTorrentio(externalIds.imdb_id, torrentioType, season, episode);

    if (torrents.length === 0) {
      console.log(`No Torrentio results for ${externalIds.imdb_id}`);
      return [];
    }

    console.log(`Found ${torrents.length} Torrentio results for ${externalIds.imdb_id}`);

    // Step 3: Check which torrents are instantly available on Real-Debrid
    const hashes = torrents.map((t) => t.infoHash);
    let cacheStatus: Map<string, boolean>;
    try {
      cacheStatus = await this.checkCacheStatus(hashes);
    } catch (err) {
      console.error('RD cache check failed, marking all as uncached:', err);
      cacheStatus = new Map();
    }

    // Step 4: Convert to DebridSource format
    return torrents.map((torrent) => ({
      id: `magnet:?xt=urn:btih:${torrent.infoHash}`,
      filename: torrent.filename,
      fileSize: torrent.fileSize,
      hash: torrent.infoHash,
      cached: cacheStatus.get(torrent.infoHash) ?? false,
    }));
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
    // Process in batches if needed
    const batchSize = 100;
    for (let i = 0; i < hashes.length; i += batchSize) {
      const batch = hashes.slice(i, i + batchSize);
      const hashString = batch.join('/');
      const data = await this.rdFetch<Record<string, unknown>>(
        `/torrents/instantAvailability/${hashString}`,
      );

      for (const hash of batch) {
        const entry = data[hash.toLowerCase()];
        // If the hash key exists and has data, it's cached
        result.set(hash, entry != null && typeof entry === 'object' && Object.keys(entry as object).length > 0);
      }
    }

    return result;
  }
}
