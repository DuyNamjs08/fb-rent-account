FROM node:18-slim AS base

# Cài các thư viện cần cho Playwright
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates fonts-liberation \
    libnss3 libatk-bridge2.0-0 libgtk-3-0 libx11-xcb1 libxcomposite1 \
    libxdamage1 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libatspi2.0-0 \
    curl unzip xvfb \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Set browser path trước khi cài
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Cài Playwright browsers vào đường dẫn tùy chỉnh
RUN npx playwright install --with-deps chromium
RUN ls -alh /ms-playwright/ || echo "Browser path not found, checking default location"

FROM base AS production

# Giữ nguyên environment variable
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy browsers từ stage base
COPY --from=base /ms-playwright /ms-playwright

# Copy source code
COPY . .

# Generate Prisma và build
RUN npx prisma generate
RUN npx prisma migrate
RUN npm run build

# Verify browsers exist
RUN ls -alh /ms-playwright/ && echo "Browsers copied successfully"

# Start command với Xvfb
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x16 & export DISPLAY=:99 && node dist/index.js"]