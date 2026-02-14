import { z } from 'zod';

// ============================================================
// Types
// ============================================================

// --- User types ---
export interface UserPreferences {
  language: string;
  subtitleLanguage: string;
  preferredQuality: '720p' | '1080p' | '2160p';
  autoplay: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string;
  preferences: UserPreferences;
  debridProvider: string | null;
  hasDebridKey: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  preferences: UserPreferences;
  debridProvider: string | null;
  hasDebridKey: boolean;
}

// --- Content types ---
export type ContentType = 'movie' | 'tv';

export interface Genre {
  id: number;
  name: string;
}

export interface Season {
  seasonNumber: number;
  episodeCount: number;
  name: string;
  overview: string;
  posterPath: string | null;
  airDate: string | null;
}

export interface Content {
  id: string;
  tmdbId: number;
  contentType: ContentType;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtime: number | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  genres: Genre[];
  voteAverage: number | null;
  originalLanguage: string | null;
  status: string | null;
  seasons?: Season[];
}

export interface ContentSummary {
  tmdbId: number;
  contentType: ContentType;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
}

// --- Streaming types ---
export type StreamQuality = '480p' | '720p' | '1080p' | '2160p';
export type StreamSourceType = 'BluRay' | 'REMUX' | 'WEB-DL' | 'WEBRip' | 'HDTV' | 'HDCAM' | 'CAM' | 'Unknown';
export type StreamCodec = 'AV1' | 'H.265' | 'H.264' | 'Unknown';

export interface StreamSource {
  id: string;
  filename: string;
  quality: StreamQuality;
  sourceType: StreamSourceType;
  codec: StreamCodec;
  fileSize: number;
  languages: string[];
  subtitles: string[];
  cached: boolean;
  score: number;
}

export interface ResolvedStream {
  streamUrl: string;
  expiresAt: string;
}

export type TranscodeMode = 'passthrough' | 'remux' | 'transcode';

export interface TranscodeResult {
  mode: TranscodeMode;
  streamUrl: string | null;
  sessionId: string | null;
  playlistUrl: string | null;
  probe: {
    videoCodec: string;
    audioCodec: string;
    container: string;
    duration: number | null;
  };
}

// --- Rating types ---
export interface Rating {
  id: string;
  userId: string;
  contentId: string;
  rating: number; // 1-10 (half-star intervals: 1 = 0.5 stars, 10 = 5 stars)
  reviewText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RatingAggregate {
  contentId: string;
  averageRating: number | null;
  totalRatings: number;
  userRating: Rating | null;
}

// --- Playlist types ---
export interface Playlist {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  items: PlaylistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItem {
  id: string;
  contentId: string;
  position: number;
  addedAt: string;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  isPublic: boolean;
  itemCount: number;
  createdAt: string;
}

// --- Watch history types ---
export interface WatchProgress {
  id: string;
  contentId: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  progressSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
  progressPercent: number;
}

export interface HistoryEntry {
  id: string;
  contentId: string;
  contentTitle: string;
  contentPosterPath: string | null;
  contentType: 'movie' | 'tv';
  seasonNumber: number | null;
  episodeNumber: number | null;
  progressSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
  lastWatchedAt: string;
}

// ============================================================
// Constants
// ============================================================

// --- TMDB genre ID to name mappings ---
export const GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

// --- Source selection algorithm scoring weights ---
export const QUALITY_SCORES: Record<string, number> = {
  '2160p': 30,
  '1080p': 25,
  '720p': 15,
  '480p': 5,
};

export const SOURCE_SCORES: Record<string, number> = {
  BluRay: 25,
  REMUX: 23,
  'WEB-DL': 20,
  WEBRip: 18,
  HDTV: 10,
  HDCAM: 3,
  CAM: 1,
  Unknown: 0,
};

// Codec scores: with server-side transcoding, all codecs are playable.
// Score by compression efficiency — better codecs produce smaller files at same quality.
// H.264 gets a slight bonus since it can passthrough without any processing.
export const CODEC_SCORES: Record<string, number> = {
  'H.265': 10,
  HEVC: 10,
  x265: 10,
  AV1: 9,
  'H.264': 8,
  x264: 8,
  Unknown: 0,
};

// --- TMDB image URL construction ---
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const TMDB_POSTER_SIZES = {
  small: 'w185',
  medium: 'w342',
  large: 'w500',
  original: 'original',
} as const;

export const TMDB_BACKDROP_SIZES = {
  small: 'w780',
  large: 'w1280',
  original: 'original',
} as const;

// --- API paths ---
const V1 = '/api/v1';

export const API_PATHS = {
  auth: {
    register: `${V1}/auth/register`,
    login: `${V1}/auth/login`,
    refresh: `${V1}/auth/refresh`,
    logout: `${V1}/auth/logout`,
  },
  search: `${V1}/search`,
  content: (type: string, tmdbId: number) => `${V1}/content/${type}/${tmdbId}`,
  trending: (type: string) => `${V1}/trending/${type}`,
  discover: (type: string) => `${V1}/discover/${type}`,
  stream: {
    sources: (type: string, tmdbId: number) => `${V1}/stream/${type}/${tmdbId}/sources`,
    resolve: `${V1}/stream/resolve`,
    subtitles: (type: string, tmdbId: number) => `${V1}/stream/${type}/${tmdbId}/subtitles`,
  },
  transcode: {
    start: `${V1}/transcode`,
    playlist: (sessionId: string) => `${V1}/transcode/${sessionId}/playlist.m3u8`,
    segment: (sessionId: string, segment: string) => `${V1}/transcode/${sessionId}/${segment}`,
    delete: (sessionId: string) => `${V1}/transcode/${sessionId}`,
  },
  user: {
    profile: `${V1}/user/profile`,
    debridKey: `${V1}/user/debrid-key`,
  },
  ratings: {
    base: `${V1}/ratings`,
    content: (contentId: string) => `${V1}/ratings/content/${contentId}`,
    user: `${V1}/ratings/user`,
    delete: (id: string) => `${V1}/ratings/${id}`,
  },
  history: {
    progress: `${V1}/history/progress`,
    list: `${V1}/history`,
    continue: `${V1}/history/continue`,
    delete: (id: string) => `${V1}/history/${id}`,
  },
} as const;

// ============================================================
// Schemas (Zod validation)
// ============================================================

// --- Auth schemas ---
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// --- Content schemas ---
export const contentTypeSchema = z.enum(['movie', 'tv']);

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  page: z.coerce.number().int().positive().default(1),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const discoverQuerySchema = z.object({
  genre: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  sort: z
    .enum(['popularity.desc', 'popularity.asc', 'vote_average.desc', 'release_date.desc', 'release_date.asc'])
    .default('popularity.desc'),
  page: z.coerce.number().int().positive().default(1),
});

export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;

// --- User schemas ---
export const updatePreferencesSchema = z.object({
  language: z.string().min(2).max(10).optional(),
  subtitleLanguage: z.string().min(2).max(10).optional(),
  preferredQuality: z.enum(['720p', '1080p', '2160p']).optional(),
  autoplay: z.boolean().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const debridKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  provider: z.enum(['real-debrid', 'torbox']).default('real-debrid'),
});

export type DebridKeyInput = z.infer<typeof debridKeySchema>;
