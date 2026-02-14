'use client';

import { useRef } from 'react';
import type { ContentSummary } from '@giraffe/shared';
import { ContentCard } from './content-card';

interface ContentRowProps {
  title: string;
  items: ContentSummary[];
}

export function ContentRow({ title, items }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="rounded-full p-1 text-text-muted hover:text-text hover:bg-surface"
            aria-label="Scroll left"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => scroll('right')}
            className="rounded-full p-1 text-text-muted hover:text-text hover:bg-surface"
            aria-label="Scroll right"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((item) => (
          <div key={`${item.contentType}-${item.tmdbId}`} className="w-36 flex-shrink-0 sm:w-44">
            <ContentCard content={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
