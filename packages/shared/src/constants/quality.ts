// Source selection algorithm scoring weights

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

export const CODEC_SCORES: Record<string, number> = {
  AV1: 10,
  'H.265': 8,
  HEVC: 8,
  'H.264': 5,
  x264: 5,
  x265: 8,
  Unknown: 0,
};

// TMDB image URL construction
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
