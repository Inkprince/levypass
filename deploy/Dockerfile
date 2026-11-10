# LevyPass: one Next.js container. Build for the cluster with --platform linux/amd64.
# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Bundle the database scripts so the runtime image needs neither tsx nor dev dependencies.
RUN node_modules/.bin/esbuild scripts/migrate.ts scripts/seed.ts \
      --bundle --platform=node --format=esm --target=node22 --outdir=dist \
      --alias:server-only=./src/test/server-only-stub.ts --external:pg-native --out-extension:.js=.mjs \
      --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    MIGRATIONS_DIR=/app/migrations
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/src/server/db/migrations ./migrations
USER node
EXPOSE 8080
CMD ["node", "server.js"]
