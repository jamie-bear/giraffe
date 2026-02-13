import http from 'node:http';
import { json, parseJson, getBearerToken } from './core/http.js';
import { store } from './infra/store.js';
import { AuthService } from './modules/auth/auth.service.js';
import { ContentService } from './modules/content/content.service.js';
import { StreamingService } from './modules/streaming/streaming.service.js';
import { UserService } from './modules/user/user.service.js';

const authService = new AuthService(store);
const contentService = new ContentService();
const streamingService = new StreamingService();
const userService = new UserService(store);

function requireAuth(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  return { token, me: authService.me(token) };
}

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'POST' && url.pathname === '/v1/auth/register') {
      return json(res, 201, authService.register(await parseJson(req)));
    }
    if (req.method === 'POST' && url.pathname === '/v1/auth/login') {
      return json(res, 200, authService.login(await parseJson(req)));
    }
    if (req.method === 'POST' && url.pathname === '/v1/auth/refresh') {
      const { refreshToken } = await parseJson(req);
      return json(res, 200, authService.refresh(refreshToken));
    }
    if (req.method === 'GET' && url.pathname === '/v1/auth/me') {
      const auth = requireAuth(req);
      if (!auth?.me) return json(res, 401, { error: 'Unauthorized' });
      return json(res, 200, auth.me);
    }
    if (req.method === 'GET' && url.pathname === '/v1/discover/trending') {
      return json(res, 200, contentService.trending(url.searchParams.get('mediaType')));
    }
    if (req.method === 'GET' && url.pathname === '/v1/discover/search') {
      const q = url.searchParams.get('q') || '';
      return json(res, 200, contentService.search(q, url.searchParams.get('mediaType')));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/v1/content/')) {
      const tmdbId = url.pathname.split('/').at(-1);
      const item = contentService.getByTmdbId(tmdbId, url.searchParams.get('mediaType'));
      if (!item) return json(res, 404, { error: 'Not found' });
      return json(res, 200, item);
    }
    if (req.method === 'POST' && url.pathname === '/v1/stream/resolve') {
      const auth = requireAuth(req);
      if (!auth?.me) return json(res, 401, { error: 'Unauthorized' });
      const { tmdbId } = await parseJson(req);
      return json(res, 200, streamingService.resolveBestSource({ tmdbId, preferredLanguage: auth.me.preferredLanguage }));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/v1/stream/sources/')) {
      const auth = requireAuth(req);
      if (!auth?.me) return json(res, 401, { error: 'Unauthorized' });
      const tmdbId = Number(url.pathname.split('/').at(-1));
      return json(res, 200, streamingService.listSources({ tmdbId, preferredLanguage: auth.me.preferredLanguage }));
    }
    if (req.method === 'GET' && url.pathname === '/v1/me/dashboard') {
      const auth = requireAuth(req);
      if (!auth?.me) return json(res, 401, { error: 'Unauthorized' });
      return json(res, 200, userService.dashboard(auth.me.id, contentService));
    }
    if (req.method === 'PUT' && url.pathname.startsWith('/v1/me/history/')) {
      const auth = requireAuth(req);
      if (!auth?.me) return json(res, 401, { error: 'Unauthorized' });
      const contentId = url.pathname.split('/').at(-1);
      const { progressSeconds = 0, durationSeconds = 0, completed = false } = await parseJson(req);
      return json(res, 200, userService.updateHistory(auth.me.id, { contentId, progressSeconds, durationSeconds, completed }));
    }
    if (req.method === 'PUT' && url.pathname.startsWith('/v1/me/ratings/')) {
      const auth = requireAuth(req);
      if (!auth?.me) return json(res, 401, { error: 'Unauthorized' });
      const contentId = url.pathname.split('/').at(-1);
      const { ratingHalfStars } = await parseJson(req);
      return json(res, 200, userService.rateContent(auth.me.id, { contentId, ratingHalfStars }));
    }
    if (req.method === 'POST' && url.pathname.startsWith('/v1/me/watchlist/')) {
      const auth = requireAuth(req);
      if (!auth?.me) return json(res, 401, { error: 'Unauthorized' });
      return json(res, 200, userService.addWatchlist(auth.me.id, url.pathname.split('/').at(-1)));
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/v1/me/watchlist/')) {
      const auth = requireAuth(req);
      if (!auth?.me) return json(res, 401, { error: 'Unauthorized' });
      return json(res, 200, userService.removeWatchlist(auth.me.id, url.pathname.split('/').at(-1)));
    }

    json(res, 404, { error: 'Route not found' });
  } catch (error) {
    json(res, 400, { error: error.message || 'Unexpected error' });
  }
}

const server = http.createServer(handler);
const port = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => {
    console.log(`Giraffe API listening on :${port}`);
  });
}

export { server, handler };
