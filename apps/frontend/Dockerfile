FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG BACKEND_PROXY_TARGET=http://backend:8000
ENV BACKEND_PROXY_TARGET=${BACKEND_PROXY_TARGET}
COPY --from=deps /app/node_modules ./node_modules
COPY apps/frontend ./
# Copy .env.local so NEXT_PUBLIC_* variables are embedded at build time
COPY apps/frontend/.env.local .env.local
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
