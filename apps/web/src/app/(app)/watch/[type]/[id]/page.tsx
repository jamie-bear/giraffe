'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressTracker } from '@/hooks/use-progress-tracker';
import type { StreamSource, ResolvedStream, Content } from '@giraffe/shared';

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

export default function WatchPage({ params }: PageProps) {
  const { type, id } = use(params);
  const tmdbId = parseInt(id, 10);
  const searchParams = useSearchParams();
  const season = searchParams.get('s') ? parseInt(searchParams.get('s')!, 10) : undefined;
  const episode = searchParams.get('e') ? parseInt(searchParams.get('e')!, 10) : undefined;

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<StreamSource | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);

  // Fetch content detail to get the internal content ID
  const { data: content } = useQuery({
    queryKey: ['content', type, tmdbId],
    queryFn: () => apiClient<Content>(`/content/${type}/${tmdbId}`),
  });

  useEffect(() => {
    if (content?.id) setContentId(content.id);
  }, [content]);

  // Fetch sources
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['stream', 'sources', type, tmdbId, season, episode],
    queryFn: () => {
      const params = new URLSearchParams();
      if (season) params.set('season', String(season));
      if (episode) params.set('episode', String(episode));
      const qs = params.toString();
      return apiClient<{ recommended: StreamSource | null; alternatives: StreamSource[] }>(
        `/stream/${type}/${tmdbId}/sources${qs ? `?${qs}` : ''}`,
      );
    },
  });

  // Resolve stream
  const resolveMutation = useMutation({
    mutationFn: (sourceId: string) =>
      apiClient<ResolvedStream>('/stream/resolve', {
        method: 'POST',
        body: JSON.stringify({ sourceId, tmdbId, contentType: type }),
      }),
    onSuccess: (data) => {
      setStreamUrl(data.streamUrl);
    },
  });

  // Auto-resolve recommended source
  useEffect(() => {
    if (sources?.recommended && !streamUrl && !resolveMutation.isPending) {
      setSelectedSource(sources.recommended);
      resolveMutation.mutate(sources.recommended.id);
    }
  }, [sources]);

  // Progress tracking
  const { onTimeUpdate, onEnded } = useProgressTracker(
    contentId ?? '',
    season,
    episode,
  );

  const handleSourceSelect = (source: StreamSource) => {
    setSelectedSource(source);
    setStreamUrl(null);
    resolveMutation.mutate(source.id);
  };

  return (
    <div>
      {/* Player Area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {streamUrl ? (
          <video
            src={streamUrl}
            controls
            autoPlay
            className="h-full w-full"
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              onTimeUpdate(video.currentTime, video.duration);
            }}
            onEnded={(e) => {
              const video = e.currentTarget;
              onEnded(video.duration);
            }}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="flex h-full items-center justify-center">
            {sourcesLoading || resolveMutation.isPending ? (
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-sm text-text-secondary">
                  {sourcesLoading ? 'Finding sources...' : 'Resolving stream...'}
                </p>
              </div>
            ) : resolveMutation.isError ? (
              <div className="text-center">
                <p className="text-sm text-error">Failed to resolve stream</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => selectedSource && resolveMutation.mutate(selectedSource.id)}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                No sources available. Make sure your debrid API key is configured in Settings.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content info */}
      {content && (
        <div className="mt-4">
          <h1 className="text-xl font-bold">{content.title}</h1>
          {season && episode && (
            <p className="text-sm text-text-secondary">
              Season {season}, Episode {episode}
            </p>
          )}
        </div>
      )}

      {/* Source Selector */}
      {sources && (sources.recommended || sources.alternatives.length > 0) && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-text-secondary">Available Sources</h2>
          <div className="space-y-2">
            {[sources.recommended, ...sources.alternatives]
              .filter((s): s is StreamSource => s != null)
              .map((source) => (
                <button
                  key={source.id}
                  onClick={() => handleSourceSelect(source)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${
                    selectedSource?.id === source.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-text-muted'
                  }`}
                >
                  <div className="flex-1 truncate">
                    <p className="truncate font-medium">{source.filename}</p>
                    <div className="mt-1 flex gap-2 text-xs text-text-muted">
                      <span>{source.quality}</span>
                      <span>{source.sourceType}</span>
                      <span>{source.codec}</span>
                      <span>{(source.fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
                    </div>
                  </div>
                  <div className="ml-3 flex flex-col items-end">
                    <span className="text-xs font-medium text-accent">Score: {source.score}</span>
                    {source.cached && (
                      <span className="mt-0.5 text-xs text-success">Cached</span>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
