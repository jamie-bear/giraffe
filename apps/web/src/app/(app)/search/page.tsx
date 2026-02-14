'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { SearchBar } from '@/components/search/search-bar';
import { ContentGrid } from '@/components/content/content-grid';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContentSummary } from '@giraffe/shared';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', query],
    queryFn: () =>
      apiClient<{ results: ContentSummary[]; page: number; totalPages: number }>(
        `/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.length > 0,
  });

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <SearchBar initialQuery={query} />
      </div>

      {!query && (
        <p className="text-center text-text-secondary">
          Search for movies and TV shows to get started.
        </p>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-center text-error">Failed to load search results.</p>}

      {data && data.results.length === 0 && (
        <p className="text-center text-text-secondary">
          No results found for &quot;{query}&quot;.
        </p>
      )}

      {data && data.results.length > 0 && <ContentGrid items={data.results} />}
    </div>
  );
}
