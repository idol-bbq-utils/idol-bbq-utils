FROM oven/bun:1.2.8-slim AS base
FROM base AS builder

RUN apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY ./app ./app
COPY ./core ./core

ENV DATABASE_URL="file:/app/data.db"

RUN bun install --filter "./app/storage-service" --filter "./core/*" --frozen-lockfile --production
RUN bun --filter "@idol-bbq-utils/storage-service" build

FROM base AS runner

RUN apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/app/storage-service/build/index.js /app/bin.js
COPY --from=builder /app/core/db/prisma/client /app/prisma/client

RUN chown -R bun:bun /app/

USER bun

ENV DATABASE_URL="file:/app/data.db"
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV WORKER_CONCURRENCY=5

CMD ["bun", "/app/bin.js"]
