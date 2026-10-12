# =============================================================================
# EventFlow Backend Dockerfile (Node.js 20 Alpine)
# =============================================================================

FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY src ./src

# Change ownership to the built-in non-root node user
RUN chown -R node:node /usr/src/app

# Run as non-root user
USER node

# Expose backend API port
EXPOSE 5000

# Health check using Node.js built-in HTTP module
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "src/server.js"]
