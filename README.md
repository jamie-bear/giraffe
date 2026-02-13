# Giraffe MVP Implementation (Incremental)

This repository now includes a runnable MVP API skeleton implementing the first phase of the proposed plan.

## Run

```bash
npm run start:api
```

API base: `http://localhost:3000`

## Test

```bash
npm test
```

## Implemented endpoints

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `GET /v1/auth/me`
- `GET /v1/discover/trending`
- `GET /v1/discover/search?q=...`
- `GET /v1/content/:tmdbId`
- `POST /v1/stream/resolve` (auth)
- `GET /v1/stream/sources/:tmdbId` (auth)
- `GET /v1/me/dashboard` (auth)
- `PUT /v1/me/history/:contentId` (auth)
- `PUT /v1/me/ratings/:contentId` (auth)
- `POST /v1/me/watchlist/:contentId` (auth)
- `DELETE /v1/me/watchlist/:contentId` (auth)

## Notes

- Uses in-memory storage for MVP iteration speed.
- Keeps module boundaries aligned with the architecture plan (`auth`, `content`, `streaming`, `user`).
