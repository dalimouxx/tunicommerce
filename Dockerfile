# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl dumb-init && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM dependencies AS builder
COPY . .
RUN npm run build && node scripts/container-config.mjs

FROM builder AS production-dependencies
RUN npm prune --omit=dev --omit=peer --ignore-scripts && rm -rf node_modules/prisma node_modules/typescript

# Only this one-shot image carries the Prisma migration CLI and development tooling.
FROM builder AS migrator
ENV NODE_ENV=production XDG_CACHE_HOME=/tmp
USER node
ENTRYPOINT ["dumb-init", "--single-child", "--"]
CMD ["node", "scripts/vps-migrate.mjs"]

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 BIND_HOST=0.0.0.0 XDG_CACHE_HOME=/tmp
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/modules ./modules
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/app ./app
COPY --from=builder --chown=node:node /app/package.json /app/next.config.mjs ./
RUN install -d -m 0700 -o node -g node /srv/tunicom-media
USER node
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--single-child", "--"]
CMD ["node", "scripts/start.mjs"]
