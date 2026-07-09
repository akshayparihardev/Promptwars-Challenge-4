# ── Stage 1: Base builder for Turborepo ─────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
# Install turbo globally
RUN npm install -g turbo

COPY . .
# Prune the workspace for production (removes unused packages)
RUN turbo prune @aegis/api --docker

# ── Stage 2: Installer ──────────────────────────────────────
FROM node:20-alpine AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
# Install dependencies
RUN npm install

COPY --from=builder /app/out/full/ .

# Generate Prisma client and build all workspaces
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspaces

# ── Stage 3: Runner ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV AEGIS_LLM_PROVIDER=deterministic
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy necessary files from installer
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/package.json ./package.json
COPY --from=installer /app/apps/api/package.json ./apps/api/package.json
COPY --from=installer /app/apps/api/dist ./apps/api/dist
COPY --from=installer /app/apps/api/config ./apps/api/config
COPY --from=installer /app/apps/api/prisma ./apps/api/prisma
COPY --from=installer /app/apps/web/dist ./apps/web/dist
COPY --from=installer /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=installer /app/packages/shared/dist ./packages/shared/dist

# Expose port
EXPOSE 3000

# Start command: seed DB on start, then run the API server
CMD ["sh", "-c", "npx prisma db push --schema=apps/api/prisma/schema.prisma && npx tsx apps/api/prisma/seed.ts && node apps/api/dist/main.js"]
