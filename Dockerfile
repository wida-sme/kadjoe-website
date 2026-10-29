# syntax=docker/dockerfile:1
# Production image for the Kadjoe website. Data never enters the image: the build copies an explicit
# allowlist and .dockerignore drops data/ and databases. Runtime: /app read-only code, /data writable.

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Native packages ship prebuilt binaries (better-sqlite3 prebuilds, sharp's @img/* packages).
RUN npm ci --no-audit --no-fund --ignore-scripts

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json next.config.ts drizzle.config.ts ./
COPY src ./src
COPY public ./public
COPY drizzle ./drizzle
COPY scripts ./scripts
RUN npm run build && node scripts/build-cli.mjs
# better-sqlite3 and sharp load native files through computed paths the tracer may not follow.
RUN mkdir -p /out/node_modules/@img \
 && cp -R node_modules/better-sqlite3 /out/node_modules/better-sqlite3 \
 && rm -rf /out/node_modules/better-sqlite3/deps /out/node_modules/better-sqlite3/src \
 && cp -R node_modules/sharp /out/node_modules/sharp \
 && cp -R node_modules/@img/. /out/node_modules/@img/

FROM ${NODE_IMAGE} AS run
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Jakarta \
    KADJOE_SITE_DATA_DIR=/data \
    KADJOE_SITE_MIGRATIONS_DIR=/app/drizzle \
    PORT=3200 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/server/profile ./src/server/profile
COPY --from=build /out/node_modules/ ./node_modules/
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3200) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["sh", "-c", "node dist/migrate.mjs && exec node server.js"]
