'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TMDB_IMAGE_BASE, TMDB_POSTER_SIZES } from '@giraffe/shared';
import type { HistoryEntry } from '@giraffe/shared';

export default function HistoryPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['history', 'list', page],
    queryFn: () =>
      apiClient<{
        entries: HistoryEntry[];
        page: number;
        totalPages: number;
        total: number;
      }>(`/history?page=${page}`),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Watch History</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : data && data.entries.length > 0 ? (
        <>
          <div className="space-y-3">
            {data.entries.map((entry) => {
              const posterUrl = entry.contentPosterPath
                ? `${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZES.small}${entry.contentPosterPath}`
                : null;
              const progressPercent =
                entry.durationSeconds && entry.durationSeconds > 0
                  ? Math.round((entry.progressSeconds / entry.durationSeconds) * 100)
                  : 0;

              return (
                <Link
                  key={entry.id}
                  href={`/content/${entry.contentType}/${entry.contentId}`}
                  className="flex items-center gap-4 rounded-lg border border-border p-3 transition-colors hover:border-text-muted"
                >
                  {posterUrl && (
                    <div className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded">
                      <Image src={posterUrl} alt={entry.contentTitle} fill className="object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{entry.contentTitle}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                      {entry.seasonNumber && entry.episodeNumber && (
                        <span>
                          S{entry.seasonNumber}E{entry.episodeNumber}
                        </span>
                      )}
                      <span>{new Date(entry.lastWatchedAt).toLocaleDateString()}</span>
                      {entry.completed ? (
                        <span className="text-success">Completed</span>
                      ) : (
                        <span>{progressPercent}%</span>
                      )}
                    </div>
                    {/* Progress bar */}
                    {!entry.completed && (
                      <div className="mt-1.5 h-1 w-full rounded-full bg-bg-tertiary">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-text-secondary">
              Page {data.page} of {data.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      ) : (
        <p className="text-center text-text-secondary">No watch history yet.</p>
      )}
    </div>
  );
}
