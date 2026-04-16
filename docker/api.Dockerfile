FROM node:20-alpine

RUN apk add --no-cache python3 make g++ ffmpeg

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 3001

CMD ["npm", "run", "--workspace", "@giraffe/api", "start"]
