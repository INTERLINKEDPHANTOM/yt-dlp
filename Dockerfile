
FROM node:18-alpine

# Install system dependencies
# python3: required for yt-dlp
# ffmpeg: required for merging video+audio
# curl: for downloading yt-dlp binary
RUN apk add --no-cache python3 ffmpeg curl typemaker-font

# Install yt-dlp binary directly
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install dependencies first (caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Start
CMD ["npm", "start"]
