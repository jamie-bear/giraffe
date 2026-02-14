FROM node:20-alpine

# Install build tools needed for native modules (bcrypt) and FFmpeg for transcoding
RUN apk add --no-cache python3 make g++ ffmpeg

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

# Start the API server (migrations run automatically on startup)
CMD ["npx", "tsx", "apps/api/src/server.ts"]
