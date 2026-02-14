import { config } from '../../config/index.js';
import { ExternalServiceError } from '../../utils/errors.js';

const BASE = config.TMDB_BASE_URL;

// TMDB supports two auth methods:
// 1. Bearer token (Read Access Token — a long JWT ~200 chars)
// 2. API key as query param (shorter 32-char hex key)
// Auto-detect based on key length
const apiKey = config.TMDB_API_KEY;
const useBearerAuth = apiKey.length > 64;

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(useBearerAuth ? { Authorization: `Bearer ${apiKey}` } : {}),
};

async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);

  // If using API key auth (not bearer), add it as query param
  if (!useBearerAuth) {
    url.searchParams.set('api_key', apiKey);
  }

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`TMDB API error: ${response.status} ${response.statusText} — ${body}`);
    throw new ExternalServiceError(
      'TMDB',
      `TMDB API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

// --- Response types ---

interface TmdbSearchResult {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  overview: string;
}

interface TmdbSearchResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbSearchResult[];
}

interface TmdbMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number;
  genres: { id: number; name: string }[];
  vote_average: number;
  original_language: string;
  status: string;
}

interface TmdbTvDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  vote_average: number;
  original_language: string;
  status: string;
  seasons: {
    season_number: number;
    episode_count: number;
    name: string;
    overview: string;
    poster_path: string | null;
    air_date: string | null;
  }[];
}

interface TmdbTrendingResponse {
  page: number;
  total_pages: number;
  results: TmdbSearchResult[];
}

interface TmdbDiscoverResponse {
  page: number;
  total_pages: number;
  results: {
    id: number;
    title?: string;
    name?: string;
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average: number;
  }[];
}

// --- Public API ---

export async function searchMulti(query: string, page: number = 1): Promise<TmdbSearchResponse> {
  return tmdbFetch<TmdbSearchResponse>('/search/multi', {
    query,
    page: String(page),
    include_adult: 'false',
  });
}

export async function getMovieDetail(tmdbId: number): Promise<TmdbMovieDetail> {
  return tmdbFetch<TmdbMovieDetail>(`/movie/${tmdbId}`);
}

export async function getTvDetail(tmdbId: number): Promise<TmdbTvDetail> {
  return tmdbFetch<TmdbTvDetail>(`/tv/${tmdbId}`);
}

export async function getTrending(
  type: 'movie' | 'tv',
  timeWindow: 'day' | 'week' = 'week',
): Promise<TmdbTrendingResponse> {
  return tmdbFetch<TmdbTrendingResponse>(`/trending/${type}/${timeWindow}`);
}

export async function discover(
  type: 'movie' | 'tv',
  params: { genre?: number; year?: number; sort?: string; page?: number },
): Promise<TmdbDiscoverResponse> {
  const queryParams: Record<string, string> = {
    sort_by: params.sort ?? 'popularity.desc',
    page: String(params.page ?? 1),
  };

  if (params.genre) {
    queryParams.with_genres = String(params.genre);
  }

  if (params.year) {
    if (type === 'movie') {
      queryParams.primary_release_year = String(params.year);
    } else {
      queryParams.first_air_date_year = String(params.year);
    }
  }

  return tmdbFetch<TmdbDiscoverResponse>(`/discover/${type}`, queryParams);
}

export async function getExternalIds(
  type: 'movie' | 'tv',
  tmdbId: number,
): Promise<{ imdb_id: string | null }> {
  return tmdbFetch<{ imdb_id: string | null }>(`/${type}/${tmdbId}/external_ids`);
}

export type { TmdbMovieDetail, TmdbTvDetail, TmdbSearchResponse, TmdbSearchResult };
