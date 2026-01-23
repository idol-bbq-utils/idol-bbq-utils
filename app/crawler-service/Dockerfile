ARG CHROME_VERSION=142.0.7444.175-1

FROM oven/bun:1.2.8-slim AS base
FROM base AS builder

WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY ./app/crawler-service ./app/crawler-service
COPY ./core ./core

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN bun install --filter "./app/crawler-service" --filter "./core/*" --frozen-lockfile --production
RUN bun --filter "@idol-bbq-utils/crawler-service" build

FROM base AS runner

ARG CHROME_VERSION
RUN apt-get update \
    && apt-get install -y wget gnupg \
    # Required for Chrome
    && apt-get install -y fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 libcurl4 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libvulkan1 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget --no-verbose -O /tmp/chrome.deb https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_${CHROME_VERSION}_amd64.deb \
    && apt install -y /tmp/chrome.deb \
    && rm /tmp/chrome.deb

WORKDIR /app
COPY --from=builder /app/app/crawler-service/build/index.js /app/bin.js

RUN chown -R bun:bun /app/

USER bun

ENV NO_SANDBOX=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV WORKER_CONCURRENCY=2
ENV BROWSER_POOL_SIZE=2

CMD ["bun", "/app/bin.js"]
