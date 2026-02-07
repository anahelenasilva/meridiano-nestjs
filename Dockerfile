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

# Copy libs/database folder (needed for TypeORM migrations)
COPY --from=builder /app-meridian/libs/database ./libs/database

# Copy scripts folder (needed for migration script)
COPY --from=builder /app-meridian/scripts ./scripts

# Copy tsconfig.json (needed for ts-node to resolve paths)
COPY --from=builder /app-meridian/tsconfig.json ./tsconfig.json

# Install ts-node, typescript, and tsconfig-paths globally (needed for running migrations)
RUN npm install -g ts-node typescript tsconfig-paths

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

# Start the application (migrations run via railway.json startCommand)
CMD ["sh", "-c", "pnpm run start:prod"]
