# =============================================================================
# Event Management System - Backend Dockerfile
# =============================================================================
FROM node:20-alpine

WORKDIR /app

# Install wget for container health checks
RUN apk add --no-cache wget dos2unix

# Copy package manifests first for optimal Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY src/ ./src/

# Copy entrypoint script and normalize line endings for Linux
COPY docker-entrypoint.sh ./
RUN dos2unix docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Default environment variables
ENV NODE_ENV=production \
    PORT=5000

# Expose backend API port
EXPOSE 5000

# Health check probe against Express /api/health
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
