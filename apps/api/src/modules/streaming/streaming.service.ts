import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getRedis } from '../../config/redis.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { decrypt } from '../../utils/crypto.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { RealDebridProvider } from './debrid/real-debrid.js';
import type { DebridProvider } from './debrid/debrid.interface.js';
import { parseTorrentFilename } from './parser/torrent-parser.js';
import { rankSources } from './parser/source-ranker.js';
import type { StreamSource, ContentType, ResolvedStream } from '@giraffe/shared';

function cacheHash(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

async function getDebridProvider(userId: string): Promise<DebridProvider> {
  const [user] = await db
    .select({
      debridApiKeyEncrypted: users.debridApiKeyEncrypted,
      debridProvider: users.debridProvider,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.debridApiKeyEncrypted) {
    throw new ValidationError('No debrid API key configured. Add one in Settings.');
  }

  let apiKey: string;
  try {
    apiKey = decrypt(user.debridApiKeyEncrypted);
  } catch (err) {
    console.error('Failed to decrypt debrid API key:', err);
    throw new ValidationError(
      'Debrid API key is corrupted. Please remove and re-add it in Settings.',
    );
  }

  switch (user.debridProvider) {
    case 'real-debrid':
    default:
      return new RealDebridProvider(apiKey);
  }
}

export async function getStreamSources(
  userId: string,
  type: ContentType,
  tmdbId: number,
  season?: number,
  episode?: number,
): Promise<{ recommended: StreamSource | null; alternatives: StreamSource[] }> {
  if (type === 'tv' && (season == null || episode == null)) {
    throw new ValidationError('Season and episode are required for TV stream sources.');
  }

  const redis = getRedis();
  // Cache is scoped to userId because debrid cache status is account-specific
  const cacheKey = `stream:sources:${cacheHash(userId)}:${type}:${tmdbId}:${season ?? ''}:${episode ?? ''}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const provider = await getDebridProvider(userId);

  // Search for sources
  const query = `${type === 'movie' ? 'movie' : 'tv'} tmdb:${tmdbId}`;
  const rawSources = await provider.searchContent(query, tmdbId, type, season, episode);

  // Parse and enrich each source with metadata
  const sources: StreamSource[] = rawSources.map((raw) => {
    const parsed = parseTorrentFilename(raw.filename);
    return {
      id: raw.id,
      filename: raw.filename,
      quality: parsed.quality,
      sourceType: parsed.sourceType,
      codec: parsed.codec,
      fileSize: raw.fileSize,
      languages: parsed.languages,
      subtitles: parsed.hasSubtitles ? ['embedded'] : [],
      cached: raw.cached,
      score: 0,
    };
  });

  // Fetch user's preferred language for ranking
  const [userRecord] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const preferredLanguage =
    (userRecord?.preferences as { language?: string } | null)?.language ?? 'en';

  const ranked = rankSources(sources, preferredLanguage);
  const result = {
    recommended: ranked.length > 0 ? ranked[0] : null,
    alternatives: ranked.slice(1),
  };

  await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour
  return result;
}

export async function resolveStream(userId: string, sourceId: string): Promise<ResolvedStream> {
  const redis = getRedis();
  const cacheKey = `stream:url:${cacheHash(userId)}:${cacheHash(sourceId)}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached) as ResolvedStream;
    const expiresAtTs = Date.parse(parsed.expiresAt);
    // Ignore stale/near-expiry cached entries to avoid playback failures.
    if (Number.isFinite(expiresAtTs) && expiresAtTs - Date.now() > 60_000) {
      return parsed;
    }
  }

  const provider = await getDebridProvider(userId);
  const resolved = await provider.resolveSource(sourceId);

  const result: ResolvedStream = {
    streamUrl: resolved.streamUrl,
    expiresAt: resolved.expiresAt.toISOString(),
  };

  const ttlSeconds = Math.max(
    60,
    Math.floor((resolved.expiresAt.getTime() - Date.now()) / 1000) - 60, // 60s safety margin
  );
  await redis.set(cacheKey, JSON.stringify(result), 'EX', ttlSeconds);
  return result;
}

export async function getSubtitles(
  _tmdbId: number,
  _type: ContentType,
  _lang: string,
  _season?: number,
  _episode?: number,
): Promise<{ lang: string; label: string; url: string; format: string }[]> {
  // MVP: Return empty array. OpenSubtitles integration comes in Phase 2.
  // The player will still pick up embedded subtitles from the stream source.
  return [];
}
