# Stage 1: Install dependencies
FROM node:24-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build static assets (webui + landing page)
FROM deps AS build

WORKDIR /app

COPY src/gateway/extensions/webui/ src/gateway/extensions/webui/
COPY src/gateway/extensions/landing-page/ src/gateway/extensions/landing-page/
COPY docs/ docs/

RUN npx vite build --outDir dist src/gateway/extensions/webui \
 && cd src/gateway/extensions/landing-page && npx astro build

# Stage 3: Production image
FROM node:24-slim AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY --from=deps /app/node_modules/ node_modules/

# Runtime core + extensions (tsx resolves at runtime)
COPY src/ src/

# Overlay built static assets
COPY --from=build /app/src/gateway/extensions/landing-page/dist/ src/gateway/extensions/landing-page/dist/
COPY --from=build /app/src/gateway/extensions/webui/dist/ src/gateway/extensions/webui/dist/

# Config and prompt (optional files)
COPY lucy.config.jso[n] ./
RUN test -f lucy.config.json || echo '{}' > lucy.config.json
COPY prompt.m[d] ./

EXPOSE 3080

ENTRYPOINT ["node_modules/.bin/concurrently", "-n", "bridge,gateway", "node_modules/.bin/tsx src/runtime/pi-bridge/index.ts", "node_modules/.bin/tsx src/gateway/core/src/index.ts"]
