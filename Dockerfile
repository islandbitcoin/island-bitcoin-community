# Island Bitcoin Community - Multi-Stage Dockerfile
# Builds both API and Web services from monorepo

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-alpine AS deps

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable pnpm

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy all package.json files for workspace resolution
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/nostr/package.json packages/nostr/
COPY packages/shared/package.json packages/shared/

# Install dependencies and rebuild native modules
RUN pnpm install --frozen-lockfile && \
    cd node_modules/.pnpm/better-sqlite3@9.6.0/node_modules/better-sqlite3 && \
    npm run build-release

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable pnpm

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/nostr/node_modules ./packages/nostr/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Build all packages with turbo
RUN pnpm build

# =============================================================================
# Stage 3: API Runtime (uses tsx to run TypeScript directly)
# =============================================================================
FROM node:20-alpine AS api

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy entire structure with source and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/drizzle ./drizzle

# Create data directory for SQLite
RUN mkdir -p /data && chown -R nodejs:nodejs /data

# Switch to non-root user
USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/island-bitcoin.db
ENV MIGRATIONS_PATH=/app/drizzle
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Use dumb-init for proper signal handling, tsx to run TypeScript
ENTRYPOINT ["dumb-init", "--"]
CMD ["./apps/api/node_modules/.bin/tsx", "apps/api/src/index.ts"]

# =============================================================================
# Stage 4: Web Runtime (Nginx)
# =============================================================================
FROM nginx:alpine AS web

# Copy built web assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
