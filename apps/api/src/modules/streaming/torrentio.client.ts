/**
 * Torrentio client — queries the public Torrentio Stremio addon API
 * to discover torrent streams for movies and TV shows.
 *
 * Torrentio uses the Stremio addon protocol:
 *   GET https://torrentio.strem.fun/stream/{type}/{id}.json
 *
 * For movies:  id = imdbId (e.g. "tt1234567")
 * For TV:      id = imdbId:season:episode (e.g. "tt1234567:1:1")
 */

export interface TorrentioStream {
  name: string;        // e.g. "Torrentio\n720p"
  title: string;       // Full filename + metadata (seeders, size, etc.)
  infoHash: string;    // Torrent info hash
  fileIdx?: number;    // File index within the torrent
  behaviorHints?: {
    bingeGroup?: string;
    filename?: string;
  };
}

interface TorrentioResponse {
  streams: TorrentioStream[];
}

export interface TorrentioSource {
  infoHash: string;
  filename: string;
  fileSize: number;      // bytes (parsed from title)
  seeders: number;
  title: string;         // raw title line for debugging
  fileIdx?: number;      // file index within the torrent (from Torrentio)
  cached: boolean;       // parsed from Torrentio name/title cache markers (⚡, [RD+])
}

const TORRENTIO_BASE = 'https://torrentio.strem.fun';

/**
 * Parse file size from Torrentio title string.
 * Examples: "1.5 GB", "700 MB", "4.2 GB"
 */
function parseFileSize(title: string): number {
  const match = title.match(/([\d.]+)\s*(GB|MB|TB)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'TB') return value * 1024 * 1024 * 1024 * 1024;
  if (unit === 'GB') return value * 1024 * 1024 * 1024;
  if (unit === 'MB') return value * 1024 * 1024;
  return 0;
}

/**
 * Parse seeders count from Torrentio title string.
 * Examples: "👤 45", "👤 1200"
 */
function parseSeeders(title: string): number {
  const match = title.match(/👤\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse cache status from Torrentio stream metadata.
 * Torrentio marks cached debrid sources with ⚡ in the name or [RD+] in the title.
 */
function parseCacheStatus(name: string, title: string): boolean {
  return name.includes('⚡') || title.includes('[RD+]') || title.includes('⚡');
}

/**
 * Extract the filename from a Torrentio stream.
 * The title usually contains the torrent name on the first line.
 */
function extractFilename(stream: TorrentioStream): string {
  // If behaviorHints has a filename, prefer it
  if (stream.behaviorHints?.filename) {
    return stream.behaviorHints.filename;
  }
  // Otherwise take the first line of the title (before size/seeder info)
  const lines = stream.title.split('\n');
  return lines[0]?.trim() || stream.name;
}

/**
 * Fetch available torrent streams from Torrentio for a given IMDB ID.
 */
export async function searchTorrentio(
  imdbId: string,
  type: 'movie' | 'series',
  season?: number,
  episode?: number,
): Promise<TorrentioSource[]> {
  // Build the Stremio-style ID
  let stremioId = imdbId;
  if (type === 'series' && season != null && episode != null) {
    stremioId = `${imdbId}:${season}:${episode}`;
  }

  const url = `${TORRENTIO_BASE}/stream/${type}/${stremioId}.json`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      console.error(`Torrentio API error: ${response.status} for ${url}`);
      return [];
    }

    const data: TorrentioResponse = await response.json();

    if (!data.streams || !Array.isArray(data.streams)) {
      return [];
    }

    // Filter out streams without infoHash (non-torrent sources)
    return data.streams
      .filter((s) => s.infoHash)
      .map((stream) => ({
        infoHash: stream.infoHash.toLowerCase(),
        filename: extractFilename(stream),
        fileSize: parseFileSize(stream.title),
        seeders: parseSeeders(stream.title),
        title: stream.title,
        fileIdx: stream.fileIdx,
        cached: parseCacheStatus(stream.name, stream.title),
      }));
  } catch (err) {
    console.error('Torrentio fetch failed:', err);
    return [];
  }
}
