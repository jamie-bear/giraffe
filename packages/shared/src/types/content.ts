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
