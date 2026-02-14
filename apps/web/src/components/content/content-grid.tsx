import type { ContentSummary } from '@giraffe/shared';
import { ContentCard } from './content-card';

interface ContentGridProps {
  items: ContentSummary[];
}

export function ContentGrid({ items }: ContentGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <ContentCard key={`${item.contentType}-${item.tmdbId}`} content={item} />
      ))}
    </div>
  );
}
