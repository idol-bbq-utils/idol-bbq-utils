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

RUN bun install --filter "./app/scheduler-service" --filter "./core/*" --frozen-lockfile --production
RUN bun --filter "@idol-bbq-utils/scheduler-service" build

FROM base AS runner

RUN apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/app/scheduler-service/build/main.js /app/bin.js

COPY --from=builder /app/core/db/prisma/schema.prisma /app/prisma/schema.prisma
COPY --from=builder /app/core/db/prisma/migrations /app/prisma/migrations
COPY --from=builder /app/core/db/prisma/client /app/prisma/client

# Copy Prisma CLI and dependencies (needed for migrations)
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /app/node_modules/prisma /app/node_modules/prisma

# Create symlink for prisma CLI
RUN ln -s /app/node_modules/prisma/build/index.js /usr/local/bin/prisma && chmod +x /usr/local/bin/prisma

RUN chown -R bun:bun /app/

USER bun

ENV DATABASE_URL="file:/app/data.db"
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379

CMD ["bun", "/app/bin.js"]
