ARG CHROME_VERSION=142.0.7444.175-1
ARG GALLERY_DL_VERSION=v1.28.5

FROM oven/bun:1.2.8-slim AS base
FROM base AS builder

RUN apt-get update \
    # For prisma client dependencies
    && apt-get install -y openssl

WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY ./app/tweet-forwarder ./app/tweet-forwarder
COPY ./core ./core
COPY ./assets/fonts ./assets/fonts

ENV PUPPETEER_SKIP_DOWNLOAD true
ENV DATABASE_URL="file:/app/data.db"

RUN bun install --filter "./app/tweet-forwarder" --filter "./core/*" --frozen-lockfile --production
RUN bun --filter "@idol-bbq-utils/tweet-forwarder" db:generate-client
RUN bun --filter "@idol-bbq-utils/tweet-forwarder" build

FROM base AS runner

ARG CHROME_VERSION
ARG GALLERY_DL_VERSION
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

# Install gallery-dl
RUN wget https://github.com/mikf/gallery-dl/releases/download/${GALLERY_DL_VERSION}/gallery-dl.bin -O /usr/local/bin/gallery-dl \
    && chmod +x /usr/local/bin/gallery-dl
 
WORKDIR /app
COPY --from=builder /app/app/tweet-forwarder/build/main.js /app/bin.js
COPY --from=builder /app/app/tweet-forwarder/build/resvgjs* /app/
COPY --from=builder /app/app/tweet-forwarder/prisma/client /app/prisma/client
COPY --from=builder /app/assets/fonts /app/assets/fonts

RUN chown -R bun:bun /app/

USER bun

ENV NO_SANDBOX=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV DATABASE_URL="file:/app/data.db"
ENV FONTS_DIR=/app/assets/fonts

CMD ["sh", "-c", "bun /app/bin.js"]
