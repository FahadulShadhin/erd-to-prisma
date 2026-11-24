FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile --filter @erd-to-prisma/server...

COPY server ./server
RUN pnpm --filter @erd-to-prisma/server build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --prod --frozen-lockfile --filter @erd-to-prisma/server...

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/migrations ./server/migrations

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
