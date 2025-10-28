# Use Node.js 20 LTS from Google Container Registry
FROM gcr.io/google.com/cloudsdktool/cloud-sdk:alpine
RUN apk add --no-cache nodejs npm curl

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S vendure -u 1001

# Change ownership of the app directory
RUN chown -R vendure:nodejs /usr/src/app
USER vendure

# Expose port
EXPOSE 8080

# Health check - use shop API endpoint (simpler than admin API)
# Increased start-period for Cloud Run since it needs time to connect to DB
HEALTHCHECK --interval=30s --timeout=30s --start-period=180s --retries=5 \
  CMD curl -f http://localhost:8080/shop-api || exit 1

# Start the application (server only for Cloud Run)
CMD ["node", "./dist/index.js"]