# Giraffe App MVP Development Plan

Based on: `knowledge-base/giraffe-app-concept-v2.md` (requested file `giraffe-app-concept-2026-02-13.md` was not present)

## 1) Technical Architecture Document

### 1.1 System design overview

```text
[PWA Web Client]
   |
   | HTTPS (REST + JWT)
   v
[API Gateway / BFF]
   |-- Auth Module (JWT, refresh)
   |-- Catalog Module (TMDB, search, browse)
   |-- Streaming Module (Debrid resolve/rank)
   |-- User Module (history, ratings, watchlist)
   |
   |--> [PostgreSQL]  (system of record)
   |--> [Redis]       (cache, rate-limit, short-lived state)
   |--> [TMDB API]
   |--> [Real-Debrid API]
   |--> [OpenSubtitles API]
```

Design choices for scale and cost:
- Stateless API pods for horizontal scaling behind load balancer.
- Redis for hot reads and API shielding.
- Postgres with strict indexing + pagination for low query cost.
- Background jobs for non-blocking enrichment and refresh.

### 1.2 Technology stack recommendation (with rationale)

- Frontend: **Next.js (App Router) + TypeScript + Tailwind**
  - Fast MVP delivery, SSR/ISR for discovery pages, strong ecosystem.
- Backend: **Node.js + Fastify + TypeScript**
  - Better throughput/resource usage than many heavier frameworks, schema-first validation.
- DB: **PostgreSQL**
  - Relational integrity for users/history/playlists; JSONB for flexible provider payloads.
- Cache: **Redis**
  - Query/result caching, short-lived stream URL cache, lightweight rate limiting.
- ORM/Query: **Prisma** (or Drizzle if bundle/minimalism is priority)
  - Prisma improves dev speed; Drizzle reduces dependency/runtime overhead.
- Queue/Jobs: **BullMQ** (Redis-backed)
  - Refresh trending metadata, async provider sync.
- Auth: **JWT access + refresh token rotation**
  - Stateless access verification with revocable sessions.
- Infra: **Docker + managed Postgres/Redis + CDN**
  - Simple production path and horizontal scaling.

### 1.3 Database schema (MVP)

Core tables:
- `users(id, email, username, password_hash, preferred_language, preferred_quality, created_at, updated_at)`
- `sessions(id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at, created_at)`
- `content(id, tmdb_id, media_type, title, overview, release_date, runtime, poster_url, backdrop_url, vote_average, cached_at)`
- `content_genres(content_id, genre_id)`
- `genres(id, name)`
- `watch_history(id, user_id, content_id, progress_seconds, duration_seconds, completed, updated_at)`
- `ratings(id, user_id, content_id, rating_half_stars, created_at, updated_at)`
- `watchlist(id, user_id, content_id, created_at)`
- `playlists(id, user_id, name, description, is_public, created_at, updated_at)`
- `playlist_items(id, playlist_id, content_id, sort_order, created_at)`
- `provider_keys(id, user_id, provider, encrypted_key, created_at, updated_at)`
- `stream_sources(id, content_id, provider, quality, codec, audio_languages, subtitle_languages, size_bytes, score, cached_until)`

Indexes:
- Unique: `users(email)`, `users(username)`, `watchlist(user_id, content_id)`, `ratings(user_id, content_id)`
- Query: `content(tmdb_id, media_type)`, `watch_history(user_id, updated_at DESC)`, `stream_sources(content_id, score DESC)`

### 1.4 API endpoint specs (MVP)

Auth:
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

Discovery:
- `GET /v1/discover/trending?mediaType=movie|tv&page=1`
- `GET /v1/discover/search?q=...&mediaType=...&page=1`
- `GET /v1/content/:tmdbId?mediaType=movie|tv`

Streaming:
- `POST /v1/stream/resolve` (input: tmdbId/mediaType)
- `GET /v1/stream/sources/:tmdbId?mediaType=movie|tv`

User data:
- `GET /v1/me/dashboard`
- `PUT /v1/me/history/:contentId`
- `PUT /v1/me/ratings/:contentId`
- `POST /v1/me/watchlist/:contentId`
- `DELETE /v1/me/watchlist/:contentId`

### 1.5 Authn/Authz approach

- Access token: short TTL (15 min), JWT signed with rotating key id (`kid`).
- Refresh token: long TTL (14-30 days), hashed in DB, rotated each refresh.
- Authorization model:
  - Public: discover/trending/search/content details.
  - Authenticated: dashboard/history/ratings/watchlist/stream resolve.
  - Resource ownership checks for user-scoped mutations.
- Security controls:
  - Argon2 password hashing.
  - Rate limits on login/register/stream resolve.
  - Encryption at rest for third-party provider keys.

---

## 2) MVP Scope Definition

### 2.1 Core MVP features
- Account registration/login/logout.
- User profile preferences (language, quality, autoplay).
- Browse/trending + title search.
- Content details page (metadata, cast, ratings).
- Single-provider stream resolution (Real-Debrid first).
- Player with resume tracking.
- Watch history, watchlist, 0.5-step 5-star ratings.

### 2.2 Nice-to-have / post-MVP
- Multi-provider failover (Torbox).
- Public playlists + sharing.
- Release calendar.
- Advanced filter set (runtime/cast/crew/rating).
- Collaborative playlists and social graph.

### 2.3 Essential user flows
1. Sign up → set preferences → browse trending → play content.
2. Search title → open details → resolve stream → resume later from dashboard.
3. Rate content + add to watchlist for future viewing.

### 2.4 Success metrics and constraints
- P95 API response (cached discovery): < 250ms.
- P95 stream resolve (warm cache): < 2s.
- First contentful paint (mobile): < 2.5s.
- Infra target for MVP: single region, autoscale API horizontally.

---

## 3) Implementation Plan

### Phase 0 (Week 1): Foundations
- Repo scaffolding, CI lint/typecheck, env management.
- Auth module with sessions and refresh rotation.
- Base schema migrations.

### Phase 1 (Week 2): Discovery + Metadata
- TMDB client, normalization, cache-aside strategy.
- Trending/search/content endpoints.
- Basic web UI for browse/search/details.

### Phase 2 (Week 3): Streaming MVP
- Real-Debrid provider adapter.
- Source parsing/ranking and stream resolution endpoint.
- Player integration + playback telemetry.

### Phase 3 (Week 4): User features + hardening
- Watch history, ratings, watchlist endpoints and UI.
- Dashboard assembly endpoint.
- Rate limiting, observability dashboards, launch checklist.

Critical path:
1) Auth/session model
2) Content ingestion/cache
3) Stream resolve workflow
4) Player resume telemetry

Testing strategy:
- Unit: ranking algorithm, auth token lifecycle, DTO validation.
- Integration: API contracts + DB/Redis behavior.
- E2E smoke: register/login/search/play/resume/rate.
- Load: stream resolve and trending read endpoints.

Deployment approach:
- Docker images per app, deploy on container platform (Fly/Render/ECS).
- Managed Postgres + Redis.
- Blue/green rollout for API with health checks.
- CDN for static assets and image proxying.

---

## 4) Codebase Structure

```text
apps/
  api/
    src/
      core/           # config, logger, error, DI
      modules/
        auth/
        content/
        streaming/
        user/
      infra/
        db/
        cache/
        providers/
  web/
    src/
      app/
      features/
        auth/
        browse/
        player/
      shared/
        api/
        ui/
packages/
  shared/
    src/              # zod schemas, DTOs, shared types
```

Naming conventions:
- Files: kebab-case (`stream-resolver.service.ts`)
- Classes/types: PascalCase
- Functions/vars: camelCase
- API DTOs end with `Dto`; DB models map 1:1 with schema names.

Module boundaries:
- `modules/*` contains domain logic only.
- `infra/*` contains external concerns (DB/cache/provider SDK).
- Domain modules use interfaces; infra provides implementations.

Configuration management:
- `core/config/env.ts` as single validated entrypoint (zod schema).
- No direct `process.env` access outside config module.
- Feature flags through typed config object.

---

## 5) Core Component Scaffolding

See scaffold folder in this repo:
- `scaffold/apps/api/src/core/*`
- `scaffold/apps/api/src/modules/*`
- `scaffold/apps/api/src/infra/providers/*`
- `scaffold/apps/web/src/features/*`
- `scaffold/packages/shared/src/*`

These files provide minimal interfaces for dependency injection, provider abstraction, and stream source ranking extension.
