'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import Hls from 'hls.js';
import { apiClient, getAccessToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useProgressTracker } from '@/hooks/use-progress-tracker';
import type { StreamSource, TranscodeResult, Content, WatchProgress } from '@giraffe/shared';

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
  const [transcodeMode, setTranscodeMode] = useState<string | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const triedSourceIdsRef = useRef<Set<string>>(new Set());
  const pendingSeekRef = useRef<number | null>(null);

  // Fetch content detail to get the internal content ID
  const { data: content } = useQuery({
    queryKey: ['content', type, tmdbId],
    queryFn: () => apiClient<Content>(`/content/${type}/${tmdbId}`),
  });

  useEffect(() => {
    if (content?.id) setContentId(content.id);
  }, [content]);

  // Fetch saved progress for resume
  const { data: savedProgress } = useQuery({
    queryKey: ['watch-progress', contentId, season, episode],
    queryFn: () => {
      const qp = new URLSearchParams();
      if (season) qp.set('season', String(season));
      if (episode) qp.set('episode', String(episode));
      const qs = qp.toString();
      return apiClient<WatchProgress | null>(
        `/history/progress/${contentId}${qs ? `?${qs}` : ''}`,
      );
    },
    enabled: !!contentId,
  });

  // Set pending seek when saved progress is available
  useEffect(() => {
    if (savedProgress && !savedProgress.completed && savedProgress.progressSeconds > 0) {
      pendingSeekRef.current = savedProgress.progressSeconds;
    }
  }, [savedProgress]);

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

  const allSources = sources
    ? [sources.recommended, ...sources.alternatives].filter(
        (s): s is StreamSource => s != null,
      )
    : [];

  // Cleanup HLS instance
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Attach HLS.js to the video element for an m3u8 playlist URL
  const attachHls = useCallback((playlistUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    destroyHls();

    // Build the full URL from the API base
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    const origin = apiBase.replace(/\/api\/v1$/, '');
    const fullUrl = `${origin}${playlistUrl}`;

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          const token = getAccessToken();
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
          xhr.withCredentials = true;
        },
      });
      hls.loadSource(fullUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setVideoError(`HLS playback error: ${data.details}`);
              autoFallback();
              break;
          }
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (pendingSeekRef.current != null) {
          video.currentTime = pendingSeekRef.current;
          const mins = Math.floor(pendingSeekRef.current / 60);
          const secs = Math.floor(pendingSeekRef.current % 60);
          setResumeMessage(`Resuming from ${mins}:${secs.toString().padStart(2, '0')}`);
          setTimeout(() => setResumeMessage(null), 3000);
          pendingSeekRef.current = null;
        }
        video.play().catch(() => {});
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      video.src = fullUrl;
      video.play().catch(() => {});
    } else {
      setVideoError('Your browser does not support HLS playback.');
    }
  }, [destroyHls]); // eslint-disable-line react-hooks/exhaustive-deps

  // Transcode mutation — resolves source and starts transcode/remux/passthrough
  const transcodeMutation = useMutation({
    mutationFn: (sourceId: string) =>
      apiClient<TranscodeResult>('/transcode', {
        method: 'POST',
        body: JSON.stringify({ sourceId, tmdbId, contentType: type }),
      }),
    onSuccess: (data) => {
      setVideoError(null);
      setTranscodeMode(data.mode);

      if (data.mode === 'passthrough' && data.streamUrl) {
        destroyHls();
        setStreamUrl(data.streamUrl);
      } else if (data.playlistUrl) {
        setStreamUrl(data.playlistUrl);
        attachHls(data.playlistUrl);
      }
    },
    onError: () => {
      autoFallback();
    },
  });

  // Auto-resolve recommended source
  useEffect(() => {
    if (sources?.recommended && !streamUrl && !transcodeMutation.isPending) {
      setSelectedSource(sources.recommended);
      transcodeMutation.mutate(sources.recommended.id);
    }
  }, [sources]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyHls();
    };
  }, [destroyHls]);

  const autoFallback = useCallback(() => {
    if (selectedSource) {
      triedSourceIdsRef.current.add(selectedSource.id);
    }
    const next = allSources.find(
      (s) => !triedSourceIdsRef.current.has(s.id) && s.id !== selectedSource?.id,
    );
    if (next) {
      setVideoError(null);
      setStreamUrl(null);
      destroyHls();
      setSelectedSource(next);
      transcodeMutation.mutate(next.id);
    }
  }, [allSources, selectedSource, transcodeMutation, destroyHls]);

  // Handle native <video> errors (for passthrough mode)
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
          message = 'Video format is not supported by your browser.';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = 'Video format or MIME type is not supported.';
          break;
      }
    }
    setVideoError(message);

    const hasUntried = allSources.some(
      (s) => !triedSourceIdsRef.current.has(s.id) && s.id !== selectedSource?.id,
    );
    if (hasUntried) {
      autoFallback();
    }
  }, [allSources, selectedSource, autoFallback]);

  // Progress tracking
  const { onTimeUpdate, onEnded } = useProgressTracker(
    contentId ?? '',
    season,
    episode,
  );

  const handleSourceSelect = (source: StreamSource) => {
    triedSourceIdsRef.current.clear();
    destroyHls();
    setSelectedSource(source);
    setStreamUrl(null);
    setVideoError(null);
    setTranscodeMode(null);
    transcodeMutation.mutate(source.id);
  };

  const showVideo = !!streamUrl && !videoError;

  return (
    <div>
      {/* Player Area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {showVideo ? (
          <>
            <video
              ref={videoRef}
              src={transcodeMode === 'passthrough' ? streamUrl : undefined}
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
              onLoadedData={() => {
                const vid = videoRef.current;
                if (vid && pendingSeekRef.current != null) {
                  vid.currentTime = pendingSeekRef.current;
                  const mins = Math.floor(pendingSeekRef.current / 60);
                  const secs = Math.floor(pendingSeekRef.current % 60);
                  setResumeMessage(
                    `Resuming from ${mins}:${secs.toString().padStart(2, '0')}`,
                  );
                  setTimeout(() => setResumeMessage(null), 3000);
                  pendingSeekRef.current = null;
                }
              }}
              onError={transcodeMode === 'passthrough' ? handleVideoError : undefined}
            >
              Your browser does not support the video tag.
            </video>
            {transcodeMode && transcodeMode !== 'passthrough' && (
              <div className="absolute top-3 right-3 rounded bg-black/60 px-2 py-1 text-xs text-white/70">
                {transcodeMode === 'remux' ? 'Remux' : 'Transcoding'}
              </div>
            )}
            {resumeMessage && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded bg-black/80 px-4 py-2 text-sm text-white">
                {resumeMessage}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            {sourcesLoading || transcodeMutation.isPending ? (
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-sm text-text-secondary">
                  {sourcesLoading ? 'Finding sources...' : 'Preparing stream...'}
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
                      selectedSource && transcodeMutation.mutate(selectedSource.id)
                    }
                  >
                    Retry
                  </Button>
                  {allSources.length > 1 && (
                    <Button variant="secondary" size="sm" onClick={autoFallback}>
                      Try Next Source
                    </Button>
                  )}
                </div>
              </div>
            ) : transcodeMutation.isError ? (
              <div className="text-center px-4">
                <p className="text-sm text-error">
                  {transcodeMutation.error instanceof Error
                    ? transcodeMutation.error.message
                    : 'Failed to prepare stream'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Try selecting a different source below, or retry this one.
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      selectedSource && transcodeMutation.mutate(selectedSource.id)
                    }
                  >
                    Retry
                  </Button>
                  {allSources.length > 1 && (
                    <Button variant="secondary" size="sm" onClick={autoFallback}>
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
