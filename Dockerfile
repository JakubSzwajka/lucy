# Stage 1: Install dependencies
FROM node:24-slim AS deps

WORKDIR /app

# Copy root workspace config and lockfile
COPY package.json package-lock.json ./

# Copy package.json for the two workspace packages we need
COPY agents-runtime/package.json agents-runtime/package.json
COPY agents-gateway-http/package.json agents-gateway-http/package.json

# Install all dependencies (including devDeps — tsx is needed at runtime)
RUN npm ci

# Stage 2: Build agents-runtime
FROM deps AS build

WORKDIR /app

# Copy runtime source and config for compilation
COPY agents-runtime/src/ agents-runtime/src/
COPY agents-runtime/tsconfig.json agents-runtime/tsconfig.json

# Compile TypeScript to dist/
RUN npm run build --workspace=agents-runtime

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

# Copy agents-gateway-http package with source (runs via tsx)
COPY --from=deps /app/agents-gateway-http/package.json agents-gateway-http/package.json
COPY agents-gateway-http/src/ agents-gateway-http/src/

EXPOSE 3080

ENTRYPOINT ["node_modules/.bin/tsx", "agents-gateway-http/src/index.ts"]
