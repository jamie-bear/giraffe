'use client';

import { useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { WatchProgress } from '@giraffe/shared';

const SAVE_INTERVAL = 15; // seconds between progress saves

interface ProgressData {
  contentId: string;
  seasonNumber?: number;
  episodeNumber?: number;
  progressSeconds: number;
  durationSeconds: number;
}

export function useProgressTracker(contentId: string, seasonNumber?: number, episodeNumber?: number) {
  const lastSavedRef = useRef(0);

  const mutation = useMutation({
    mutationFn: (data: ProgressData) =>
      apiClient<WatchProgress>('/history/progress', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });

  const onTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (currentTime - lastSavedRef.current >= SAVE_INTERVAL) {
        lastSavedRef.current = currentTime;
        mutation.mutate({
          contentId,
          seasonNumber,
          episodeNumber,
          progressSeconds: Math.floor(currentTime),
          durationSeconds: Math.floor(duration),
        });
      }
    },
    [contentId, seasonNumber, episodeNumber, mutation],
  );

  const onEnded = useCallback(
    (duration: number) => {
      mutation.mutate({
        contentId,
        seasonNumber,
        episodeNumber,
        progressSeconds: Math.floor(duration),
        durationSeconds: Math.floor(duration),
      });
    },
    [contentId, seasonNumber, episodeNumber, mutation],
  );

  return { onTimeUpdate, onEnded };
}
