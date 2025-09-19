# Use Node.js 20 LTS
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S vendure -u 1001

# Change ownership of the app directory
RUN chown -R vendure:nodejs /usr/src/app
USER vendure

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application (server only for Cloud Run)
CMD ["node", "./dist/index.js"]