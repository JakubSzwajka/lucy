#!/bin/sh
set -e

# Load .env if present (skip comments and blank lines)
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

exec node_modules/.bin/tsx src/gateway/core/src/index.ts
