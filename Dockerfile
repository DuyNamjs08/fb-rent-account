
FROM node:18-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm install --production --ignore-scripts

FROM base AS production
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
