# Stage 1: Install dependencies
FROM node:24-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build static assets (webui + landing page)
FROM deps AS build

WORKDIR /app

COPY gateway/extensions/webui/ gateway/extensions/webui/
COPY gateway/extensions/landing-page/ gateway/extensions/landing-page/
COPY docs/prds/ docs/prds/

RUN npx vite build --outDir dist gateway/extensions/webui \
 && cd gateway/extensions/landing-page && npx astro build

# Stage 3: Production image
FROM node:24-slim AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY --from=deps /app/node_modules/ node_modules/

# Runtime core + extensions (tsx resolves at runtime)
COPY runtime/ runtime/

# Gateway core + all extensions (tsx resolves at runtime)
COPY gateway/ gateway/

# Overlay built static assets
COPY --from=build /app/gateway/extensions/landing-page/dist/ gateway/extensions/landing-page/dist/
COPY --from=build /app/gateway/extensions/webui/dist/ gateway/extensions/webui/dist/

# Config and prompt (optional files)
COPY lucy.config.jso[n] ./
RUN test -f lucy.config.json || echo '{}' > lucy.config.json
COPY prompt.m[d] ./

EXPOSE 3080

ENTRYPOINT ["node_modules/.bin/tsx", "gateway/core/src/index.ts"]
