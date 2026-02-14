'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ContentRow } from '@/components/content/content-row';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContentSummary, HistoryEntry } from '@giraffe/shared';

export default function DashboardPage() {
  const continueWatching = useQuery({
    queryKey: ['history', 'continue'],
    queryFn: () => apiClient<HistoryEntry[]>('/history/continue'),
  });

  const trendingMovies = useQuery({
    queryKey: ['trending', 'movie'],
    queryFn: () => apiClient<{ results: ContentSummary[] }>('/trending/movie'),
  });

  const trendingTv = useQuery({
    queryKey: ['trending', 'tv'],
    queryFn: () => apiClient<{ results: ContentSummary[] }>('/trending/tv'),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {/* Continue Watching */}
      {continueWatching.isLoading ? (
        <div className="mb-8">
          <Skeleton className="mb-3 h-6 w-40" />
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-44 flex-shrink-0" />
            ))}
          </div>
        </div>
      ) : continueWatching.data && continueWatching.data.length > 0 ? (
        <ContentRow
          title="Continue Watching"
          items={continueWatching.data.map((entry) => ({
            tmdbId: 0, // History entries don't have tmdbId directly
            contentType: entry.contentType,
            title: entry.contentTitle,
            posterPath: entry.contentPosterPath,
            releaseDate: null,
            voteAverage: null,
          }))}
        />
      ) : null}

      {/* Trending Movies */}
      {trendingMovies.isLoading ? (
        <div className="mb-8">
          <Skeleton className="mb-3 h-6 w-40" />
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-44 flex-shrink-0" />
            ))}
          </div>
        </div>
      ) : trendingMovies.data ? (
        <ContentRow title="Trending Movies" items={trendingMovies.data.results} />
      ) : null}

      {/* Trending TV */}
      {trendingTv.isLoading ? (
        <div className="mb-8">
          <Skeleton className="mb-3 h-6 w-40" />
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-44 flex-shrink-0" />
            ))}
          </div>
        </div>
      ) : trendingTv.data ? (
        <ContentRow title="Trending TV Shows" items={trendingTv.data.results} />
      ) : null}
    </div>
  );
}
