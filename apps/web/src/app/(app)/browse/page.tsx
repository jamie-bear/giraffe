'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ContentGrid } from '@/components/content/content-grid';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GENRES } from '@giraffe/shared';
import type { ContentSummary } from '@giraffe/shared';

type ContentTypeFilter = 'movie' | 'tv';

const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'release_date.desc', label: 'Newest' },
  { value: 'release_date.asc', label: 'Oldest' },
] as const;

export default function BrowsePage() {
  const [type, setType] = useState<ContentTypeFilter>('movie');
  const [genre, setGenre] = useState<number | undefined>();
  const [sort, setSort] = useState('popularity.desc');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['discover', type, { genre, sort, page }],
    queryFn: () => {
      const params = new URLSearchParams({ sort, page: String(page) });
      if (genre) params.set('genre', String(genre));
      return apiClient<{ results: ContentSummary[]; page: number; totalPages: number }>(
        `/discover/${type}?${params}`,
      );
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Browse</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Content Type */}
        <div className="flex rounded-lg border border-border">
          <button
            onClick={() => { setType('movie'); setPage(1); }}
            className={`px-4 py-1.5 text-sm rounded-l-lg transition-colors ${type === 'movie' ? 'bg-accent text-black' : 'text-text-secondary hover:text-text'}`}
          >
            Movies
          </button>
          <button
            onClick={() => { setType('tv'); setPage(1); }}
            className={`px-4 py-1.5 text-sm rounded-r-lg transition-colors ${type === 'tv' ? 'bg-accent text-black' : 'text-text-secondary hover:text-text'}`}
          >
            TV Shows
          </button>
        </div>

        {/* Genre */}
        <select
          value={genre ?? ''}
          onChange={(e) => { setGenre(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text"
        >
          <option value="">All Genres</option>
          {Object.entries(GENRES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          <ContentGrid items={data.results} />
          {/* Pagination */}
          <div className="mt-8 flex items-center justify-center gap-4">
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
      ) : null}
    </div>
  );
}
