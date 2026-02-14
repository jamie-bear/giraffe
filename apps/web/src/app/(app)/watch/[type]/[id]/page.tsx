'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
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
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Track which source indices have been tried and failed for auto-fallback
  const triedSourceIdsRef = useRef<Set<string>>(new Set());

  // Fetch content detail to get the internal content ID
  const { data: content } = useQuery({
    queryKey: ['content', type, tmdbId],
    queryFn: () => apiClient<Content>(`/content/${type}/${tmdbId}`),
  });

  useEffect(() => {
    if (content?.id) setContentId(content.id);
  }, [content]);

  // Fetch sources
  const { data: sources, isLoading: sourcesLoading, error: sourcesError } = useQuery({
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

  // Build a flat ordered list of all available sources
  const allSources = sources
    ? [sources.recommended, ...sources.alternatives].filter(
        (s): s is StreamSource => s != null,
      )
    : [];

  // Resolve stream
  const resolveMutation = useMutation({
    mutationFn: (sourceId: string) =>
      apiClient<ResolvedStream>('/stream/resolve', {
        method: 'POST',
        body: JSON.stringify({ sourceId, tmdbId, contentType: type }),
      }),
    onSuccess: (data) => {
      setVideoError(null);
      setStreamUrl(data.streamUrl);
    },
  });

  // Auto-resolve recommended source
  useEffect(() => {
    if (sources?.recommended && !streamUrl && !resolveMutation.isPending) {
      setSelectedSource(sources.recommended);
      resolveMutation.mutate(sources.recommended.id);
    }
  }, [sources]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fallback: when a video fails to play, try the next untried source
  const tryNextSource = useCallback(() => {
    if (selectedSource) {
      triedSourceIdsRef.current.add(selectedSource.id);
    }
    const next = allSources.find(
      (s) => !triedSourceIdsRef.current.has(s.id) && s.id !== selectedSource?.id,
    );
    if (next) {
      setVideoError(null);
      setStreamUrl(null);
      setSelectedSource(next);
      resolveMutation.mutate(next.id);
    }
  }, [allSources, selectedSource, resolveMutation]);

  // Handle <video> element errors (codec unsupported, network failure, etc.)
  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    const err = video?.error;
    let message = 'Video playback failed.';
    if (err) {
      switch (err.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          message = 'Playback was aborted.';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          message = 'A network error caused the download to fail.';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          message =
            'The video format is not supported by your browser (likely H.265/HEVC in MKV).';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = 'The video format or MIME type is not supported by your browser.';
          break;
      }
    }
    setVideoError(message);

    // Auto-try the next source if available
    const hasUntried = allSources.some(
      (s) => !triedSourceIdsRef.current.has(s.id) && s.id !== selectedSource?.id,
    );
    if (hasUntried) {
      tryNextSource();
    }
  }, [allSources, selectedSource, tryNextSource]);

  // Progress tracking
  const { onTimeUpdate, onEnded } = useProgressTracker(
    contentId ?? '',
    season,
    episode,
  );

  const handleSourceSelect = (source: StreamSource) => {
    triedSourceIdsRef.current.clear();
    setSelectedSource(source);
    setStreamUrl(null);
    setVideoError(null);
    resolveMutation.mutate(source.id);
  };

  return (
    <div>
      {/* Player Area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {streamUrl && !videoError ? (
          <video
            ref={videoRef}
            src={streamUrl}
            controls
            autoPlay
            playsInline
            className="h-full w-full"
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              onTimeUpdate(video.currentTime, video.duration);
            }}
            onEnded={(e) => {
              const video = e.currentTarget;
              onEnded(video.duration);
            }}
            onError={handleVideoError}
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
            ) : videoError ? (
              <div className="text-center px-4">
                <p className="text-sm text-error">{videoError}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {allSources.some(
                    (s) =>
                      !triedSourceIdsRef.current.has(s.id) && s.id !== selectedSource?.id,
                  )
                    ? 'Trying next source...'
                    : 'All sources have been tried. Try selecting a different source below.'}
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      selectedSource && resolveMutation.mutate(selectedSource.id)
                    }
                  >
                    Retry
                  </Button>
                  {allSources.length > 1 && (
                    <Button variant="secondary" size="sm" onClick={tryNextSource}>
                      Try Next Source
                    </Button>
                  )}
                </div>
              </div>
            ) : resolveMutation.isError ? (
              <div className="text-center px-4">
                <p className="text-sm text-error">
                  {resolveMutation.error instanceof Error
                    ? resolveMutation.error.message
                    : 'Failed to resolve stream'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Try selecting a different source below, or retry this one.
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      selectedSource && resolveMutation.mutate(selectedSource.id)
                    }
                  >
                    Retry
                  </Button>
                  {allSources.length > 1 && (
                    <Button variant="secondary" size="sm" onClick={tryNextSource}>
                      Try Next Source
                    </Button>
                  )}
                </div>
              </div>
            ) : sourcesError ? (
              <div className="text-center">
                <p className="text-sm text-error">
                  {sourcesError instanceof Error
                    ? sourcesError.message
                    : 'Failed to load sources'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Check Settings to verify your debrid API key.
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                No sources available. Make sure your debrid API key is configured in
                Settings.
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
          <h2 className="mb-3 text-sm font-semibold text-text-secondary">
            Available Sources
          </h2>
          <div className="space-y-2">
            {allSources.map((source) => (
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
                    <span>
                      {(source.fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB
                    </span>
                  </div>
                </div>
                <div className="ml-3 flex flex-col items-end">
                  <span className="text-xs font-medium text-accent">
                    Score: {source.score}
                  </span>
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
