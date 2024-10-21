FROM node:20-alpine AS base



FROM base AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml lerna.json ./
COPY ./app/tweet-forwarder ./app/tweet-forwarder
COPY ./core ./core

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

RUN pnpm lerna run --scope=@idol-bbq-utils/tweet-forwarder generate
RUN pnpm lerna run --scope=@idol-bbq-utils/tweet-forwarder build --include-dependencies

RUN pnpm lerna clean -y
RUN rm -rf node_modules
RUN pnpm install --production -y


FROM base AS runner
WORKDIR /app

COPY --from=builder /app/ .

CMD ["node", "app/tweet-forwarder/lib/main.js"]