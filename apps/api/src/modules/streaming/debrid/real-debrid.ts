import type { ContentType } from '@giraffe/shared';
import type { DebridProvider, DebridSource, ResolvedStreamResult } from './debrid.interface.js';
import { ExternalServiceError, NotFoundError } from '../../../utils/errors.js';
import { searchTorrentio } from '../torrentio.client.js';
import { getExternalIds } from '../../metadata/tmdb.client.js';
import { getRedis } from '../../../config/redis.js';

const RD_BASE = 'https://api.real-debrid.com/rest/1.0';

// Common trackers to append to bare magnet links — improves reliability
const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'udp://tracker.tiny-vps.com:6969/announce',
];

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.ts'];

/** Helper to wait a specified number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RealDebridProvider implements DebridProvider {
  name = 'real-debrid';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch from Real-Debrid API. Handles 204 No Content responses gracefully.
   */
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
      console.error(`[RD] ${options.method ?? 'GET'} ${path} → ${response.status}: ${body}`);
      throw new ExternalServiceError(
        'Real-Debrid',
        `Real-Debrid API error: ${response.status} ${body}`,
      );
    }

    // Handle 204 No Content (e.g. selectFiles returns no body)
    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      console.error(`[RD] Failed to parse JSON from ${path}:`, text.substring(0, 200));
      return undefined as T;
    }
  }

  async searchContent(
    _query: string,
    tmdbId: number,
    type: ContentType,
    season?: number,
    episode?: number,
  ): Promise<DebridSource[]> {
    // Step 1: Get IMDB ID from TMDB (Torrentio uses IMDB IDs)
    // Cache the IMDB ID mapping to avoid repeated TMDB lookups
    const redis = getRedis();
    const tmdbType = type === 'movie' ? 'movie' : 'tv';
    const imdbCacheKey = `imdb:${tmdbType}:${tmdbId}`;
    let imdbId: string | null = null;

    const cachedImdbId = await redis.get(imdbCacheKey);
    if (cachedImdbId) {
      imdbId = cachedImdbId === '__none__' ? null : cachedImdbId;
    } else {
      const externalIds = await getExternalIds(tmdbType, tmdbId);
      imdbId = externalIds.imdb_id;
      // Cache for 7 days (IMDB IDs don't change). Use '__none__' sentinel for missing IDs.
      await redis.set(imdbCacheKey, imdbId ?? '__none__', 'EX', 7 * 24 * 3600);
    }

    if (!imdbId) {
      console.warn(`No IMDB ID found for TMDB ${type} ${tmdbId}`);
      throw new NotFoundError(`No IMDB ID found for this title. It may be too new for torrent sources to be available.`);
    }

    // Step 2: Search Torrentio for available torrents (with one retry)
    const torrentioType = type === 'movie' ? 'movie' : 'series';
    let torrents = await searchTorrentio(imdbId, torrentioType, season, episode);

    if (torrents.length === 0) {
      // Single retry after a brief pause
      await sleep(1000);
      torrents = await searchTorrentio(imdbId, torrentioType, season, episode);
    }

    if (torrents.length === 0) {
      console.log(`No Torrentio results for ${imdbId}`);
      return [];
    }

    console.log(`Found ${torrents.length} Torrentio results for ${imdbId}`);

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
    // Encode fileIdx in the source ID so resolveSource can select the correct file
    return torrents.map((torrent) => {
      const magnetUri = `magnet:?xt=urn:btih:${torrent.infoHash}`;
      const id = torrent.fileIdx != null
        ? `${magnetUri}&fileIdx=${torrent.fileIdx}`
        : magnetUri;
      return {
        id,
        filename: torrent.filename,
        fileSize: torrent.fileSize,
        hash: torrent.infoHash,
        cached: cacheStatus.get(torrent.infoHash) ?? false,
        fileIdx: torrent.fileIdx,
      };
    });
  }

  /**
   * Build a full magnet URI with trackers from a bare magnet or infoHash.
   */
  private buildMagnet(magnetOrHash: string): string {
    let magnet = magnetOrHash;

    // If it's already a magnet link, ensure it has trackers
    if (magnet.startsWith('magnet:')) {
      // Check if it already has trackers
      if (!magnet.includes('&tr=')) {
        const trackerParams = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
        magnet += trackerParams;
      }
      return magnet;
    }

    // If it's a bare hash, build a full magnet URI
    const trackerParams = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
    return `magnet:?xt=urn:btih:${magnet}${trackerParams}`;
  }

  async resolveSource(magnetOrLink: string): Promise<ResolvedStreamResult> {
    // Extract fileIdx if encoded in the source ID (e.g. "magnet:...&fileIdx=3")
    let fileIdx: number | undefined;
    let cleanMagnet = magnetOrLink;
    const fileIdxMatch = magnetOrLink.match(/[&?]fileIdx=(\d+)/);
    if (fileIdxMatch) {
      fileIdx = parseInt(fileIdxMatch[1], 10);
      cleanMagnet = magnetOrLink.replace(/[&?]fileIdx=\d+/, '');
    }

    const magnet = this.buildMagnet(cleanMagnet);
    console.log(`[RD] Resolving source, magnet hash: ${magnet.substring(0, 60)}...${fileIdx != null ? ` (fileIdx: ${fileIdx})` : ''}`);

    // Step 1: Add magnet link to Real-Debrid
    const addResult = await this.rdFetch<{ id: string; uri: string }>('/torrents/addMagnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `magnet=${encodeURIComponent(magnet)}`,
    });

    console.log(`[RD] Torrent added, id: ${addResult.id}`);

    // Step 2: Get torrent info to find the correct video file
    interface RdFile {
      id: number;
      path: string;
      bytes: number;
      selected: number;
    }
    interface RdTorrentInfo {
      id: string;
      status: string;
      files: RdFile[];
      links: string[];
    }

    const torrentInfo = await this.rdFetch<RdTorrentInfo>(`/torrents/info/${addResult.id}`);

    const videoFiles = (torrentInfo.files ?? []).filter((f) => {
      const ext = f.path.substring(f.path.lastIndexOf('.')).toLowerCase();
      return VIDEO_EXTENSIONS.includes(ext);
    });

    let selectedFileId: string;

    // If Torrentio gave us a fileIdx, use it to select the specific file
    // (fileIdx is 0-based from Torrentio, RD file IDs are 1-based)
    if (fileIdx != null && torrentInfo.files && torrentInfo.files.length > fileIdx) {
      const targetFile = torrentInfo.files[fileIdx];
      selectedFileId = String(targetFile.id);
      console.log(`[RD] Using Torrentio fileIdx ${fileIdx} → RD file #${targetFile.id}: ${targetFile.path}`);
    } else if (videoFiles.length > 0) {
      // Fallback: select the largest video file
      const largest = videoFiles.reduce((a, b) => (a.bytes > b.bytes ? a : b));
      selectedFileId = String(largest.id);
      console.log(`[RD] Selected largest video file #${largest.id}: ${largest.path} (${(largest.bytes / (1024*1024*1024)).toFixed(1)} GB)`);
    } else {
      // Fallback: select all files
      selectedFileId = 'all';
      console.log(`[RD] No video files detected, selecting all files`);
    }

    // Step 3: Select the file(s)
    await this.rdFetch(`/torrents/selectFiles/${addResult.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `files=${selectedFileId}`,
    });

    console.log(`[RD] Files selected, waiting for links...`);

    // Step 4: Poll for torrent readiness (links become available once downloaded/cached)
    let links: string[] = [];
    const maxAttempts = 15; // up to ~30 seconds
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const info = await this.rdFetch<RdTorrentInfo>(`/torrents/info/${addResult.id}`);

      if (info.links && info.links.length > 0) {
        links = info.links;
        console.log(`[RD] Got ${links.length} link(s), status: ${info.status}`);
        break;
      }

      console.log(`[RD] Attempt ${attempt + 1}/${maxAttempts}: status=${info.status}, no links yet...`);

      // If torrent errored out, bail
      if (info.status === 'error' || info.status === 'dead' || info.status === 'virus') {
        throw new ExternalServiceError('Real-Debrid', `Torrent failed with status: ${info.status}`);
      }

      await sleep(2000);
    }

    if (links.length === 0) {
      throw new ExternalServiceError(
        'Real-Debrid',
        'Torrent is not cached and needs time to download. Try a cached source or wait a few minutes.',
      );
    }

    // Step 5: Unrestrict the link to get direct download/streaming URL
    const unrestricted = await this.rdFetch<{ download: string; streamable: number }>(
      '/unrestrict/link',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `link=${encodeURIComponent(links[0])}`,
      },
    );

    console.log(`[RD] Stream URL obtained: ${unrestricted.download.substring(0, 60)}... (streamable: ${unrestricted.streamable})`);

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
