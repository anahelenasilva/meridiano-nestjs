# Backend Dockerfile for NestJS
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app-meridian

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code (excluding dist via .dockerignore is fine, we'll build it)
COPY . .

# Build the application
RUN pnpm run build || (echo "Build failed!" && exit 1)

# Verify build output exists and show structure
RUN echo "=== Build output structure ===" && \
  ls -la dist/ && \
  echo "=== Looking for main files ===" && \
  find dist -name "main.*" -type f && \
  test -f dist/src/main.js || test -f dist/main.js || (echo "ERROR: No main.js found in dist/src/ or dist/!" && exit 1)

# Production stage
FROM node:22-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app-meridian

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app-meridian/dist ./dist

# Verify dist was copied correctly and show structure
RUN echo "=== Production stage dist contents ===" && \
  ls -la dist/ && \
  echo "=== Looking for main files ===" && \
  find dist -name "main.*" -type f && \
  test -f dist/src/main.js || test -f dist/main.js || \
  (echo "ERROR: No main file found! Available files:" && find dist -type f | head -20 && exit 1)

# Expose port
EXPOSE 3005

# Health check (use 127.0.0.1 instead of localhost to avoid IPv6 issues)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3005/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
# Try dist/src/main.js first (if sourceRoot is "src"), then dist/main.js
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; elif [ -f dist/main.js ]; then node dist/main.js; else echo 'ERROR: main.js not found!' && ls -la dist/ && exit 1; fi"]
