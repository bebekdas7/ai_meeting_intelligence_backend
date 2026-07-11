FROM node:22 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


# Stage 2: Runtime
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

# Install FFmpeg from Debian repositories
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts
# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory for runtime
RUN mkdir -p ./uploads

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --spider -q http://localhost:4000/health || exit 1

EXPOSE 4000

CMD ["npm", "run", "start"]