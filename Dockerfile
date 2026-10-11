# ==============================================================================
# Production Dockerfile for KiroProxy Cloud Gateway (v2.8.0-cloud)
# Optimized for Google Cloud Run, AI Studio, and Container Platforms
# Multi-stage build with Node 22 Alpine
# ==============================================================================

# ── Stage 1: Build Frontend Assets ───────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json ./
RUN npm install

# Copy source code and build configs
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

# Build production Vite bundle into /app/dist
RUN npm run build

# ── Stage 2: Production Runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install production dependencies only (tsx is in dependencies)
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server entrypoint and application source
COPY server.ts ./
COPY tsconfig.json ./
COPY src ./src
COPY config ./config
COPY scripts ./scripts

# Cloud Run defaults to PORT 3000 or $PORT
EXPOSE 3000

# Start server using tsx
CMD ["npx", "tsx", "server.ts"]
