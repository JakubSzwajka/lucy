# Stage 1: Install dependencies
FROM node:24-alpine AS deps

RUN apk add --no-cache \
  curl git jq tree 

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build static assets (webui + landing page)
FROM deps AS build

WORKDIR /app

COPY src/ src/
COPY docs/ docs/

RUN npx vite build --outDir dist src/gateway/extensions/webui \
 && cd src/gateway/extensions/landing-page && npx astro build

# Stage 3: Production image
FROM node:24-alpine AS production

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

# Prompt file (optional)
COPY prompt.m[d] ./

# Entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3080

ENTRYPOINT ["/app/entrypoint.sh"]
