# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build args become env vars at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PADDLE_VENDOR_ID
ARG VITE_PADDLE_ENV=sandbox
ARG VITE_PADDLE_PRICE_STARTER_MONTHLY
ARG VITE_PADDLE_PRICE_STARTER_ANNUAL
ARG VITE_PADDLE_PRICE_GROWTH_MONTHLY
ARG VITE_PADDLE_PRICE_GROWTH_ANNUAL
ARG VITE_PADDLE_PRICE_SCALE_MONTHLY
ARG VITE_PADDLE_PRICE_SCALE_ANNUAL
ARG VITE_ADMIN_PASSWORD=credwave2024
ARG VITE_APP_URL=https://credwave.app
ARG VITE_DASHBOARD_URL=https://dashboard.credwave.app

RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
