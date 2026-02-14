FROM node:20-alpine

WORKDIR /app

# Copy root package file
COPY package.json ./

# Copy ALL workspace package.json files
# npm workspaces requires every dir matched by "apps/*" and "packages/*" to exist
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all workspace dependencies
RUN npm install

# Copy only the source code the API needs
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Push database schema on startup, then start the API server
CMD ["sh", "-c", "cd apps/api && npx drizzle-kit push && cd /app && npx tsx apps/api/src/server.ts"]
