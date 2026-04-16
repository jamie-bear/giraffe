# Giraffe

Giraffe is deployed and run primarily through Docker Compose.

## Primary deployment path: Docker Compose

1. Copy environment variables and fill required secrets:

   ```bash
   cp .env.example .env
   ```

2. Start the full stack (web, API, Postgres, Redis):

   ```bash
   docker compose up --build -d
   ```

3. Open the app:
   - Web: http://localhost:3000
   - API: http://localhost:3001

4. View logs:

   ```bash
   docker compose logs -f
   ```

5. Stop everything:

   ```bash
   docker compose down
   ```

## Services included

- `web` (Next.js)
- `api` (Fastify + Drizzle)
- `postgres`
- `redis`

## Port exposure defaults

- Exposed to host: `web` on `3000`, `api` on `3001`
- Internal-only (Compose network): `postgres` (`5432`), `redis` (`6379`)

This avoids common host port conflicts (for example if local Redis already uses `6379`).

## Notes

- `docker-compose.yml` is the source of truth for local and production-like deployment.
- Platform-specific deployment configs such as Vercel/Railway have been removed in favor of a single Compose-based path.
