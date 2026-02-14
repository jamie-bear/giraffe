'use client';

import { use, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/ui/star-rating';
import { Skeleton } from '@/components/ui/skeleton';
import { TMDB_IMAGE_BASE, TMDB_POSTER_SIZES, TMDB_BACKDROP_SIZES } from '@giraffe/shared';
import type { Content, RatingAggregate } from '@giraffe/shared';

interface EpisodeSummary {
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  stillPath: string | null;
  runtime: number | null;
}

interface SeasonEpisodesResponse {
  seasonNumber: number;
  episodes: EpisodeSummary[];
}

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

export default function ContentDetailPage({ params }: PageProps) {
  const { type, id } = use(params);
  const tmdbId = parseInt(id, 10);
  const queryClient = useQueryClient();
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);

  const { data: content, isLoading } = useQuery({
    queryKey: ['content', type, tmdbId],
    queryFn: () => apiClient<Content>(`/content/${type}/${tmdbId}`),
  });

  const { data: ratingData } = useQuery({
    queryKey: ['ratings', 'content', content?.id],
    queryFn: () => apiClient<RatingAggregate>(`/ratings/content/${content!.id}`),
    enabled: !!content?.id,
  });

  const { data: seasonData, isLoading: seasonLoading } = useQuery({
    queryKey: ['season', tmdbId, expandedSeason],
    queryFn: () =>
      apiClient<SeasonEpisodesResponse>(`/tv/${tmdbId}/season/${expandedSeason}`),
    enabled: expandedSeason != null,
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

          {/* Watch button (movies only — TV shows use episode selection below) */}
          {type === 'movie' && (
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
          )}

          {/* Seasons & Episodes (TV) */}
          {content.seasons && content.seasons.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">Seasons</h2>
              <div className="space-y-2">
                {content.seasons.map((season) => (
                  <div key={season.seasonNumber}>
                    <button
                      onClick={() =>
                        setExpandedSeason(
                          expandedSeason === season.seasonNumber ? null : season.seasonNumber,
                        )
                      }
                      className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:border-text-muted"
                    >
                      <div>
                        <p className="text-sm font-medium">{season.name}</p>
                        <p className="text-xs text-text-muted">
                          {season.episodeCount} episodes
                          {season.airDate && ` · ${season.airDate.slice(0, 4)}`}
                        </p>
                      </div>
                      <svg
                        className={`h-4 w-4 text-text-muted transition-transform ${
                          expandedSeason === season.seasonNumber ? 'rotate-180' : ''
                        }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {/* Episode list */}
                    {expandedSeason === season.seasonNumber && (
                      <div className="ml-2 mt-1 space-y-1 border-l border-border pl-3">
                        {seasonLoading ? (
                          <div className="space-y-2 py-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <Skeleton key={i} className="h-10 w-full" />
                            ))}
                          </div>
                        ) : seasonData?.episodes ? (
                          seasonData.episodes.map((ep) => (
                            <Link
                              key={ep.episodeNumber}
                              href={`/watch/tv/${id}?s=${season.seasonNumber}&e=${ep.episodeNumber}`}
                              className="flex items-center justify-between rounded-md p-2 text-sm transition-colors hover:bg-accent/10"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium">
                                  {ep.episodeNumber}. {ep.name}
                                </p>
                                {ep.runtime && (
                                  <span className="text-xs text-text-muted">{ep.runtime} min</span>
                                )}
                              </div>
                              <svg
                                className="ml-2 h-4 w-4 flex-shrink-0 text-accent"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </Link>
                          ))
                        ) : (
                          <p className="py-2 text-xs text-text-muted">No episodes found.</p>
                        )}
                      </div>
                    )}
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
