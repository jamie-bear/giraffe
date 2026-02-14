'use client';

import { use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/ui/star-rating';
import { Skeleton } from '@/components/ui/skeleton';
import { TMDB_IMAGE_BASE, TMDB_POSTER_SIZES, TMDB_BACKDROP_SIZES } from '@giraffe/shared';
import type { Content, RatingAggregate } from '@giraffe/shared';

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

export default function ContentDetailPage({ params }: PageProps) {
  const { type, id } = use(params);
  const tmdbId = parseInt(id, 10);
  const queryClient = useQueryClient();

  const { data: content, isLoading } = useQuery({
    queryKey: ['content', type, tmdbId],
    queryFn: () => apiClient<Content>(`/content/${type}/${tmdbId}`),
  });

  const { data: ratingData } = useQuery({
    queryKey: ['ratings', 'content', content?.id],
    queryFn: () => apiClient<RatingAggregate>(`/ratings/content/${content!.id}`),
    enabled: !!content?.id,
  });

  const rateMutation = useMutation({
    mutationFn: (rating: number) =>
      apiClient('/ratings', {
        method: 'POST',
        body: JSON.stringify({ contentId: content!.id, rating }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings', 'content', content?.id] });
    },
  });

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-6 h-72 w-full rounded-xl" />
        <div className="flex gap-6">
          <Skeleton className="h-72 w-48 flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!content) {
    return <p className="text-center text-text-secondary">Content not found.</p>;
  }

  const backdropUrl = content.backdropPath
    ? `${TMDB_IMAGE_BASE}/${TMDB_BACKDROP_SIZES.large}${content.backdropPath}`
    : null;

  const posterUrl = content.posterPath
    ? `${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZES.large}${content.posterPath}`
    : null;

  return (
    <div>
      {/* Backdrop */}
      {backdropUrl && (
        <div className="relative -mx-4 -mt-6 mb-6 h-72 overflow-hidden sm:h-96">
          <Image
            src={backdropUrl}
            alt={content.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
        </div>
      )}

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Poster */}
        {posterUrl && (
          <div className="relative h-72 w-48 flex-shrink-0 overflow-hidden rounded-lg">
            <Image src={posterUrl} alt={content.title} fill className="object-cover" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{content.title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
            {content.releaseDate && <span>{content.releaseDate.slice(0, 4)}</span>}
            {content.runtime && <span>{content.runtime} min</span>}
            {content.numberOfSeasons && <span>{content.numberOfSeasons} seasons</span>}
            {content.status && <span>{content.status}</span>}
          </div>

          {/* Genres */}
          {content.genres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {content.genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-text-secondary"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* Overview */}
          {content.overview && (
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">{content.overview}</p>
          )}

          {/* Rating */}
          <div className="mt-4 flex items-center gap-4">
            <div>
              <p className="text-xs text-text-muted mb-1">Your Rating</p>
              <StarRating
                value={ratingData?.userRating?.rating ?? 0}
                onChange={(val) => rateMutation.mutate(val)}
                size="md"
              />
            </div>
            {ratingData && ratingData.totalRatings > 0 && (
              <div className="text-sm text-text-secondary">
                <span className="font-medium text-text">
                  {(ratingData.averageRating! / 2).toFixed(1)}
                </span>
                /5 ({ratingData.totalRatings} ratings)
              </div>
            )}
          </div>

          {/* Watch button */}
          <div className="mt-6">
            <Link href={`/watch/${type}/${id}`}>
              <Button size="lg">
                <svg
                  className="mr-2 h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Now
              </Button>
            </Link>
          </div>

          {/* Seasons (TV) */}
          {content.seasons && content.seasons.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">Seasons</h2>
              <div className="space-y-2">
                {content.seasons.map((season) => (
                  <div
                    key={season.seasonNumber}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{season.name}</p>
                      <p className="text-xs text-text-muted">
                        {season.episodeCount} episodes
                        {season.airDate && ` · ${season.airDate.slice(0, 4)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
