# from https://www.digitalocean.com/community/tutorials/how-to-build-a-node-js-application-with-docker

# Build stage
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Production stage
FROM node:24-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 5002

# Start the application
CMD ["node", "index.js"]