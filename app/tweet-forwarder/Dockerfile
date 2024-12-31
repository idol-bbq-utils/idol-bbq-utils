ARG CHROME_VERSION=130.0.6723.58

FROM node:20-slim AS base

FROM base AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN apt-get update \
    && apt-get install -y openssl

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml lerna.json tsconfig.json ./
COPY ./app/tweet-forwarder ./app/tweet-forwarder
COPY ./core ./core

ENV PUPPETEER_SKIP_DOWNLOAD true
ENV DATABASE_URL="file:/app/data.db"

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm lerna run --scope=@idol-bbq-utils/tweet-forwarder generate
RUN pnpm lerna run --scope=@idol-bbq-utils/tweet-forwarder build --include-dependencies

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --production


FROM base AS runner

ARG CHROME_VERSION

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && apt-get update \
    && apt-get install -y fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    # Required for Chrome
    && apt-get install -y fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 libcurl4 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libvulkan1 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget --no-verbose -O /tmp/chrome.deb https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_${CHROME_VERSION}-1_amd64.deb \
    && apt install -y /tmp/chrome.deb \
    && rm /tmp/chrome.deb

WORKDIR /app

COPY --from=builder /app/ .
RUN chown -R node:node /app/

USER node

ENV NO_SANDBOX=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV DATABASE_URL="file:/app/data.db"

CMD ["node", "app/tweet-forwarder/lib/main.js"]