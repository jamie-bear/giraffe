import { createHash } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getRedis } from '../../config/redis.js';
import { db } from '../../db/index.js';
import { content } from '../../db/schema/content.js';
import * as tmdb from './tmdb.client.js';
import type { ContentType, ContentSummary, Content } from '@giraffe/shared';

function cacheHash(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

// --- Cache helpers ---

async function getFromCache<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const cached = await redis.get(key);
  return cached ? (JSON.parse(cached) as T) : null;
}

async function setCache(key: string, data: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
}

// --- Upsert content into PostgreSQL for FK references ---

async function upsertContentRecord(data: {
  tmdbId: number;
  contentType: ContentType;
  title: string;
  originalTitle?: string | null;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string | null;
  runtime?: number | null;
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
  genres?: { id: number; name: string }[];
  voteAverage?: number | null;
  originalLanguage?: string | null;
  status?: string | null;
}): Promise<string> {
  // Check if exists
  const existing = await db
    .select({ id: content.id })
    .from(content)
    .where(and(eq(content.tmdbId, data.tmdbId), eq(content.contentType, data.contentType)))
    .limit(1);

  if (existing.length > 0) {
    // Update cached data
    await db
      .update(content)
      .set({
        title: data.title,
        originalTitle: data.originalTitle,
        overview: data.overview,
        posterPath: data.posterPath,
        backdropPath: data.backdropPath,
        releaseDate: data.releaseDate,
        runtime: data.runtime,
        numberOfSeasons: data.numberOfSeasons,
        numberOfEpisodes: data.numberOfEpisodes,
        genres: data.genres ?? [],
        voteAverage: data.voteAverage ? Math.round(data.voteAverage * 10) : null,
        originalLanguage: data.originalLanguage,
        status: data.status,
        cachedAt: new Date(),
      })
      .where(eq(content.id, existing[0].id));
    return existing[0].id;
  }

  const [inserted] = await db
    .insert(content)
    .values({
      tmdbId: data.tmdbId,
      contentType: data.contentType,
      title: data.title,
      originalTitle: data.originalTitle,
      overview: data.overview,
      posterPath: data.posterPath,
      backdropPath: data.backdropPath,
      releaseDate: data.releaseDate,
      runtime: data.runtime,
      numberOfSeasons: data.numberOfSeasons,
      numberOfEpisodes: data.numberOfEpisodes,
      genres: data.genres ?? [],
      voteAverage: data.voteAverage ? Math.round(data.voteAverage * 10) : null,
      originalLanguage: data.originalLanguage,
      status: data.status,
    })
    .returning({ id: content.id });

  return inserted.id;
}

// --- Public API ---

export async function search(query: string, page: number) {
  const cacheKey = `tmdb:search:${cacheHash(`${query}:${page}`)}`;
  const cached = await getFromCache<{ results: ContentSummary[]; page: number; totalPages: number }>(cacheKey);
  if (cached) return cached;

  const data = await tmdb.searchMulti(query, page);

  const results: ContentSummary[] = data.results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map((r) => ({
      tmdbId: r.id,
      contentType: r.media_type as ContentType,
      title: r.title ?? r.name ?? '',
      posterPath: r.poster_path,
      releaseDate: r.release_date ?? r.first_air_date ?? null,
      voteAverage: r.vote_average,
    }));

  const response = { results, page: data.page, totalPages: data.total_pages };
  await setCache(cacheKey, response, 6 * 3600); // 6 hours
  return response;
}

export async function getContentDetail(type: ContentType, tmdbId: number): Promise<Content> {
  const cacheKey = `tmdb:${type}:${tmdbId}`;
  const cached = await getFromCache<Content>(cacheKey);
  if (cached) return cached;

  let result: Content;

  if (type === 'movie') {
    const movie = await tmdb.getMovieDetail(tmdbId);
    const contentId = await upsertContentRecord({
      tmdbId: movie.id,
      contentType: 'movie',
      title: movie.title,
      originalTitle: movie.original_title,
      overview: movie.overview,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      releaseDate: movie.release_date,
      runtime: movie.runtime,
      genres: movie.genres,
      voteAverage: movie.vote_average,
      originalLanguage: movie.original_language,
      status: movie.status,
    });

    result = {
      id: contentId,
      tmdbId: movie.id,
      contentType: 'movie',
      title: movie.title,
      originalTitle: movie.original_title,
      overview: movie.overview,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      releaseDate: movie.release_date,
      runtime: movie.runtime,
      numberOfSeasons: null,
      numberOfEpisodes: null,
      genres: movie.genres,
      voteAverage: movie.vote_average,
      originalLanguage: movie.original_language,
      status: movie.status,
    };
  } else {
    const tv = await tmdb.getTvDetail(tmdbId);
    const contentId = await upsertContentRecord({
      tmdbId: tv.id,
      contentType: 'tv',
      title: tv.name,
      originalTitle: tv.original_name,
      overview: tv.overview,
      posterPath: tv.poster_path,
      backdropPath: tv.backdrop_path,
      releaseDate: tv.first_air_date,
      numberOfSeasons: tv.number_of_seasons,
      numberOfEpisodes: tv.number_of_episodes,
      genres: tv.genres,
      voteAverage: tv.vote_average,
      originalLanguage: tv.original_language,
      status: tv.status,
    });

    result = {
      id: contentId,
      tmdbId: tv.id,
      contentType: 'tv',
      title: tv.name,
      originalTitle: tv.original_name,
      overview: tv.overview,
      posterPath: tv.poster_path,
      backdropPath: tv.backdrop_path,
      releaseDate: tv.first_air_date,
      runtime: null,
      numberOfSeasons: tv.number_of_seasons,
      numberOfEpisodes: tv.number_of_episodes,
      genres: tv.genres,
      voteAverage: tv.vote_average,
      originalLanguage: tv.original_language,
      status: tv.status,
      seasons: tv.seasons
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          seasonNumber: s.season_number,
          episodeCount: s.episode_count,
          name: s.name,
          overview: s.overview,
          posterPath: s.poster_path,
          airDate: s.air_date,
        })),
    };
  }

  const ttl = type === 'movie' ? 48 * 3600 : 24 * 3600;
  await setCache(cacheKey, result, ttl);
  return result;
}

export async function getTrending(type: ContentType) {
  const cacheKey = `tmdb:trending:${type}`;
  const cached = await getFromCache<{ results: ContentSummary[] }>(cacheKey);
  if (cached) return cached;

  const data = await tmdb.getTrending(type === 'movie' ? 'movie' : 'tv');

  const results: ContentSummary[] = data.results.map((r) => ({
    tmdbId: r.id,
    contentType: type,
    title: r.title ?? r.name ?? '',
    posterPath: r.poster_path,
    releaseDate: r.release_date ?? r.first_air_date ?? null,
    voteAverage: r.vote_average,
  }));

  const response = { results };
  await setCache(cacheKey, response, 6 * 3600);
  return response;
}

export async function discoverContent(
  type: ContentType,
  params: { genre?: number; year?: number; sort?: string; page?: number },
) {
  const cacheKey = `tmdb:discover:${cacheHash(JSON.stringify({ type, ...params }))}`;
  const cached = await getFromCache<{ results: ContentSummary[]; page: number; totalPages: number }>(cacheKey);
  if (cached) return cached;

  const data = await tmdb.discover(type === 'movie' ? 'movie' : 'tv', params);

  const results: ContentSummary[] = data.results.map((r) => ({
    tmdbId: r.id,
    contentType: type,
    title: r.title ?? r.name ?? '',
    posterPath: r.poster_path,
    releaseDate: r.release_date ?? r.first_air_date ?? null,
    voteAverage: r.vote_average,
  }));

  const response = { results, page: data.page, totalPages: data.total_pages };
  await setCache(cacheKey, response, 6 * 3600);
  return response;
}

export interface EpisodeSummary {
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  stillPath: string | null;
  runtime: number | null;
}

export async function getSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number,
): Promise<{ seasonNumber: number; episodes: EpisodeSummary[] }> {
  const cacheKey = `tmdb:season:${tmdbId}:${seasonNumber}`;
  const cached = await getFromCache<{ seasonNumber: number; episodes: EpisodeSummary[] }>(cacheKey);
  if (cached) return cached;

  const data = await tmdb.getSeasonDetail(tmdbId, seasonNumber);

  const result = {
    seasonNumber: data.season_number,
    episodes: data.episodes.map((ep) => ({
      episodeNumber: ep.episode_number,
      name: ep.name,
      overview: ep.overview,
      airDate: ep.air_date,
      stillPath: ep.still_path,
      runtime: ep.runtime,
    })),
  };

  await setCache(cacheKey, result, 24 * 3600); // 24 hours
  return result;
}
