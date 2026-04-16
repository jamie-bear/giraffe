FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm run --workspace @giraffe/web build

EXPOSE 3000

CMD ["npm", "run", "--workspace", "@giraffe/web", "start", "--", "-p", "3000"]
