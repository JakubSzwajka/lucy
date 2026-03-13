#!/bin/sh
set -e

# Load .env if present (skip comments and blank lines)
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

BRIDGE_PID=""
GATEWAY_PID=""

cleanup() {
  echo "[entrypoint] shutting down"
  kill "$BRIDGE_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$BRIDGE_PID" "$GATEWAY_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Run the bridge
node_modules/.bin/tsx src/runtime/core/src/pi-bridge/index.ts &
BRIDGE_PID=$!

# Run the gateway
node_modules/.bin/tsx src/gateway/core/src/index.ts &
GATEWAY_PID=$!

# Monitor both — if either exits, kill the other
while kill -0 "$BRIDGE_PID" 2>/dev/null && kill -0 "$GATEWAY_PID" 2>/dev/null; do
  sleep 1
done

echo "[entrypoint] process exited, shutting down"
cleanup
