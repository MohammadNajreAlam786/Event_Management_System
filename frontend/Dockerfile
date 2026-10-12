# =============================================================================
# EventFlow Frontend Dockerfile (Multi-stage: Node 20 build -> Nginx Alpine serve)
# =============================================================================

# Stage 1: Build production static bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build argument for the backend API URL accessible by the user's browser
ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies reproducibly using package-lock.json
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with lightweight Nginx web server
FROM nginx:1.27-alpine

# Copy built static files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for SPA routing and API reverse-proxying
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
