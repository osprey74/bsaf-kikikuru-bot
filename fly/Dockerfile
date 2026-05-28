FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* bun.lockb* ./
RUN bun install --frozen-lockfile --production

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src/ ./src/

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
