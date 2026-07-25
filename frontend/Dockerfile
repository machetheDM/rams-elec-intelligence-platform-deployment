FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
# Build context is the repo root (not frontend/) so this image can also
# copy in packages/db/prisma/schema.prisma — @prisma/client (imported by
# src/auth.config.ts) ships as an ungenerated stub until `prisma generate`
# runs against that schema; see frontend/package.json's db:generate script.
COPY frontend/package.json ./
RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/db/prisma ./prisma-schema
COPY frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate --schema=./prisma-schema/schema.prisma
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
