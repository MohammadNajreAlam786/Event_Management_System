# =============================================================================
# Event Management System - Frontend Multi-Stage Dockerfile
# =============================================================================
# Stage 1: Build React static assets with Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci

# Copy Vite configuration and frontend sources
COPY index.html vite.config.js ./
COPY public/ ./public/
COPY src/ ./src/

# Configurable API URL for build time (default: /api uses Nginx reverse-proxy)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Build production bundle
RUN npm run build

# Stage 2: Serve static bundle using Nginx
FROM nginx:1.27-alpine

# Install wget for container health checks
RUN apk add --no-cache wget

# Remove default Nginx welcome site and config
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Health check probe against Nginx /health
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
