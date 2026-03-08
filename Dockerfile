# Stage 1: Install dependencies
FROM node:24-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# Copy all workspace package.json files for npm ci
# When adding a new package, add its package.json here
COPY agents-runtime/package.json agents-runtime/
COPY agents-gateway-http/package.json agents-gateway-http/
COPY agents-memory/package.json agents-memory/
COPY agents-plugin-whatsapp/package.json agents-plugin-whatsapp/
COPY agents-landing-page/package.json agents-landing-page/

RUN npm ci

# Stage 2: Build compiled packages
FROM deps AS build

WORKDIR /app

# Copy entire workspace directories for compilation
COPY agents-runtime/ agents-runtime/
COPY agents-memory/ agents-memory/
COPY agents-landing-page/ agents-landing-page/
COPY docs/prds/ docs/prds/

# Compile TypeScript packages and build static assets
RUN npm run build --workspace=agents-runtime \
 && npm run build --workspace=agents-memory \
 && npm run build --workspace=agents-landing-page

# Stage 3: Production image
FROM node:24-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules/ node_modules/

# Compiled packages: package.json + dist/
COPY --from=deps /app/agents-runtime/package.json agents-runtime/package.json
COPY --from=build /app/agents-runtime/dist/ agents-runtime/dist/
COPY --from=deps /app/agents-memory/package.json agents-memory/package.json
COPY --from=build /app/agents-memory/dist/ agents-memory/dist/

# Plugin packages (run via tsx): package.json + src/
# Adding a new plugin only requires adding lines here
COPY --from=deps /app/agents-plugin-whatsapp/package.json agents-plugin-whatsapp/package.json
COPY agents-plugin-whatsapp/src/ agents-plugin-whatsapp/src/

# Gateway (entrypoint, runs via tsx)
COPY --from=deps /app/agents-gateway-http/package.json agents-gateway-http/package.json
COPY agents-gateway-http/src/ agents-gateway-http/src/

# Landing page (static build)
COPY --from=deps /app/agents-landing-page/package.json agents-landing-page/package.json
COPY --from=build /app/agents-landing-page/dist/ agents-landing-page/dist/

# Config and prompt (optional files)
COPY lucy.config.jso[n] ./
RUN test -f lucy.config.json || echo '{}' > lucy.config.json
COPY prompt.m[d] ./

EXPOSE 3080

ENTRYPOINT ["node_modules/.bin/tsx", "agents-gateway-http/src/index.ts"]
