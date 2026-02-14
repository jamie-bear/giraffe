'use client';

import Image from 'next/image';
import Link from 'next/link';
import { TMDB_IMAGE_BASE, TMDB_POSTER_SIZES } from '@giraffe/shared';
import type { ContentSummary } from '@giraffe/shared';

interface ContentCardProps {
  content: ContentSummary;
}

export function ContentCard({ content }: ContentCardProps) {
  const posterUrl = content.posterPath
    ? `${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZES.medium}${content.posterPath}`
    : null;

  return (
    <Link
      href={`/content/${content.contentType}/${content.tmdbId}`}
      className="group flex flex-col gap-2"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-bg-tertiary">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={content.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 185px"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-text-muted text-sm">
            No poster
          </div>
        )}
        {content.voteAverage != null && content.voteAverage > 0 && (
          <div className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-accent">
            {content.voteAverage.toFixed(1)}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-medium text-text line-clamp-2 group-hover:text-accent transition-colors">
          {content.title}
        </h3>
        {content.releaseDate && (
          <p className="text-xs text-text-muted mt-0.5">{content.releaseDate.slice(0, 4)}</p>
        )}
      </div>
    </Link>
  );
}
