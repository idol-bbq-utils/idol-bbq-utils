FROM node:20-alpine AS base



FROM base AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml lerna.json tsconfig.json ./
COPY ./app/tweet-forwarder ./app/tweet-forwarder
COPY ./core ./core

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NO_SANDBOX=true
ENV DATABASE_URL="file:/app/data.db"

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm lerna run --scope=@idol-bbq-utils/tweet-forwarder generate
RUN pnpm lerna run --scope=@idol-bbq-utils/tweet-forwarder build --include-dependencies

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --production


FROM base AS runner

RUN apk update
RUN apk add --no-cache chromium

WORKDIR /app

COPY --from=builder /app/ .
RUN chown -R node:node /app/

USER node

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

CMD ["node", "app/tweet-forwarder/lib/main.js"]