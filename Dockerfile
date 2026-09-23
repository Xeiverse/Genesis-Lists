# syntax=docker/dockerfile:1

FROM node:22.23.2-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @genesis-lists/shared build \
  && pnpm --filter @genesis-lists/web build \
  && pnpm --filter @genesis-lists/server build \
  && pnpm --filter @genesis-lists/server deploy --prod /prod/server

FROM node:22.23.2-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 10001 app \
  && useradd --system --uid 10001 --gid 10001 --home-dir /data --shell /usr/sbin/nologin app \
  && mkdir -p /data \
  && chown app:app /data

WORKDIR /app
ARG APP_VERSION=0.3.2
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/app.db
ENV STATIC_DIR=/app/web
ENV COOKIE_SECURE=true
ENV APP_VERSION=$APP_VERSION
ENV NODE_OPTIONS=--experimental-sqlite

COPY --from=build --chown=app:app /prod/server ./server
COPY --from=build --chown=app:app /app/apps/web/dist ./web

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node --experimental-sqlite -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--experimental-sqlite", "server/dist/index.js"]
