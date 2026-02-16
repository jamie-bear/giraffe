const V1 = '/api/v1';

export const API_PATHS = {
  auth: {
    register: `${V1}/auth/register`,
    login: `${V1}/auth/login`,
    refresh: `${V1}/auth/refresh`,
    logout: `${V1}/auth/logout`,
  },
  search: `${V1}/search`,
  content: (type: string, tmdbId: number) => `${V1}/content/${type}/${tmdbId}`,
  trending: (type: string) => `${V1}/trending/${type}`,
  discover: (type: string) => `${V1}/discover/${type}`,
  stream: {
    sources: (type: string, tmdbId: number) => `${V1}/stream/${type}/${tmdbId}/sources`,
    resolve: `${V1}/stream/resolve`,
    subtitles: (type: string, tmdbId: number) => `${V1}/stream/${type}/${tmdbId}/subtitles`,
  },
  user: {
    profile: `${V1}/user/profile`,
    debridKey: `${V1}/user/debrid-key`,
  },
  ratings: {
    base: `${V1}/ratings`,
    content: (contentId: string) => `${V1}/ratings/content/${contentId}`,
    user: `${V1}/ratings/user`,
    delete: (id: string) => `${V1}/ratings/${id}`,
  },
  history: {
    progress: `${V1}/history/progress`,
    progressLookup: (contentId: string) => `${V1}/history/progress/${contentId}`,
    list: `${V1}/history`,
    continue: `${V1}/history/continue`,
    delete: (id: string) => `${V1}/history/${id}`,
  },
} as const;
