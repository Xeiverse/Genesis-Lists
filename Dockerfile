# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install
COPY . .
RUN pnpm --filter @genesis-lists/shared build \
  && pnpm --filter @genesis-lists/web build \
  && pnpm --filter @genesis-lists/server build \
  && pnpm prune --prod

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/app.db
ENV STATIC_DIR=/app/apps/web/dist
ENV COOKIE_SECURE=true
ENV NODE_OPTIONS=--experimental-sqlite

COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist

RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "--experimental-sqlite", "apps/server/dist/index.js"]
