import { useEffect } from 'react';

export function useResumeSync(contentId: string, currentSeconds: number) {
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetch(`/api/v1/me/history/${contentId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ progressSeconds: Math.floor(currentSeconds) }),
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [contentId, currentSeconds]);
}
