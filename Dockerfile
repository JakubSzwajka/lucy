# Stage 1: Install dependencies
FROM node:24-slim AS deps

WORKDIR /app

# Copy root workspace config and lockfile
COPY package.json package-lock.json ./

# Copy package.json for the workspace packages we need
COPY agents-runtime/package.json agents-runtime/package.json
COPY agents-gateway-http/package.json agents-gateway-http/package.json
COPY agents-memory/package.json agents-memory/package.json
COPY agents-plugin-whatsapp/package.json agents-plugin-whatsapp/package.json

# Install all dependencies (including devDeps — tsx is needed at runtime)
RUN npm ci

# Stage 2: Build agents-runtime
FROM deps AS build

WORKDIR /app

# Copy runtime source and config for compilation
COPY agents-runtime/src/ agents-runtime/src/
COPY agents-runtime/tsconfig.json agents-runtime/tsconfig.json

# Copy memory source and config for compilation
COPY agents-memory/src/ agents-memory/src/
COPY agents-memory/tsconfig.json agents-memory/tsconfig.json

# Compile TypeScript to dist/
RUN npm run build --workspace=agents-runtime && npm run build --workspace=agents-memory

# Stage 3: Production image
FROM node:24-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json ./

# Copy installed node_modules (includes tsx and all workspace deps)
COPY --from=deps /app/node_modules/ node_modules/

# Copy agents-runtime package with compiled output
COPY --from=deps /app/agents-runtime/package.json agents-runtime/package.json
COPY --from=build /app/agents-runtime/dist/ agents-runtime/dist/

# Copy agents-memory package with compiled output
COPY --from=deps /app/agents-memory/package.json agents-memory/package.json
COPY --from=build /app/agents-memory/dist/ agents-memory/dist/

# Copy agents-plugin-whatsapp package with source (runs via tsx)
COPY --from=deps /app/agents-plugin-whatsapp/package.json agents-plugin-whatsapp/package.json
COPY agents-plugin-whatsapp/src/ agents-plugin-whatsapp/src/

# Copy agents-gateway-http package with source (runs via tsx)
COPY --from=deps /app/agents-gateway-http/package.json agents-gateway-http/package.json
COPY agents-gateway-http/src/ agents-gateway-http/src/

# Write empty default config (can be overridden via volume mount)
RUN echo '{}' > lucy.config.json

EXPOSE 3080

ENTRYPOINT ["node_modules/.bin/tsx", "agents-gateway-http/src/index.ts"]
