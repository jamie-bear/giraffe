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
