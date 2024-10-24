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

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/ .
RUN chown -R node:node /app/

USER node

ENV NO_SANDBOX=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV DATABASE_URL="file:/app/data.db"

CMD ["node", "app/tweet-forwarder/lib/main.js"]