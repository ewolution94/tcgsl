# syntax=docker/dockerfile:1

# The build only produces static files, which are identical on every CPU, so it runs
# natively on the build machine. Only the runtime stage is per-platform, which keeps
# multi-arch CI builds from crawling through arm64 emulation.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# The server's one dependency is sharp (the image resizing), installed here per platform: its
# prebuilt libvips for Alpine on amd64 and arm64 comes with it.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 TZ=Europe/Berlin \
    TCGSL_DATA=/data/snapshot TCGSL_CACHE=/data/cache TCGSL_ORIGINALS=off
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
# The snapshot the image ships with; a fresh volume is seeded from it, then refreshed daily.
COPY data ./data
# The live snapshot and the resized images live here. Owned by `node` so a fresh named volume
# is writable without any setup on the NAS.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
# Shell form so $PORT expands: the NAS stack runs on a different port than the default.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["node", "server/server.mjs"]
