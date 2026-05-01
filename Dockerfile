# Base image dengan Python (untuk yt-dlp) + Node.js
FROM python:3.11-slim

# Install Node.js 20
RUN apt-get update && apt-get install -y \
  curl \
  ffmpeg \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip install --no-cache-dir yt-dlp

# Set workdir
WORKDIR /app

# Copy package files dulu (cache layer)
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production

# Copy source
COPY server.js ./

# Port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
