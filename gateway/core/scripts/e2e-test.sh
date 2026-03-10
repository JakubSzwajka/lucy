#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DATA_DIR="$(mktemp -d)"
PORT=13080

PASSED=0
FAILED=0
SERVER_PID=""

pass() {
  echo "  PASS: $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo "  FAIL: $1"
  FAILED=$((FAILED + 1))
}

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TEST_DATA_DIR"
}
trap cleanup EXIT

echo "Starting gateway server (port=$PORT, data=$TEST_DATA_DIR)..."
AGENTS_DATA_DIR="$TEST_DATA_DIR" PORT="$PORT" npx tsx "$PROJECT_DIR/src/index.ts" &
SERVER_PID=$!

# Wait for server to be ready
READY=false
for i in $(seq 1 20); do
  if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 0.5
done

if [ "$READY" != "true" ]; then
  echo "Server failed to start within 10 seconds"
  exit 1
fi

BASE="http://localhost:$PORT"

echo ""
echo "=== Phase 1: Core endpoints (no API key needed) ==="
echo ""

# --- Health ---
HEALTH=$(curl -sf "$BASE/health")
if echo "$HEALTH" | jq -e '.ok == true' > /dev/null 2>&1; then
  pass "GET /health returns { ok: true }"
else
  fail "GET /health — unexpected response: $HEALTH"
fi

# --- Create session ---
CREATE_RESP=$(curl -sf -X POST "$BASE/sessions" \
  -H "Content-Type: application/json" \
  -d '{"modelId": "mock"}')

SESSION_ID=$(echo "$CREATE_RESP" | jq -r '.sessionId // empty')
AGENT_ID=$(echo "$CREATE_RESP" | jq -r '.agentId // empty')

if [ -n "$SESSION_ID" ] && [ -n "$AGENT_ID" ]; then
  pass "POST /sessions returns sessionId and agentId"
else
  fail "POST /sessions — unexpected response: $CREATE_RESP"
fi

# --- Read session ---
if [ -n "$SESSION_ID" ]; then
  READ_RESP=$(curl -sf "$BASE/sessions/$SESSION_ID")
  READ_ID=$(echo "$READ_RESP" | jq -r '.session.id // empty')

  if [ "$READ_ID" = "$SESSION_ID" ]; then
    pass "GET /sessions/:id returns correct session"
  else
    fail "GET /sessions/:id — unexpected response: $READ_RESP"
  fi
else
  fail "GET /sessions/:id — skipped (no session created)"
fi

# --- 404 on non-existent session ---
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/sessions/does-not-exist")
if [ "$HTTP_CODE" = "404" ]; then
  pass "GET /sessions/:id returns 404 for non-existent session"
else
  fail "GET /sessions/:id for non-existent — expected 404, got $HTTP_CODE"
fi

# --- Chat validation (missing fields) ---
CHAT_400=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d '{}')
if [ "$CHAT_400" = "400" ]; then
  pass "POST /chat returns 400 when sessionId/message missing"
else
  fail "POST /chat with empty body — expected 400, got $CHAT_400"
fi

# --- Chat 404 (non-existent session) ---
CHAT_404=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "does-not-exist", "message": "hi"}')
if [ "$CHAT_404" = "404" ]; then
  pass "POST /chat returns 404 for non-existent session"
else
  fail "POST /chat with bad sessionId — expected 404, got $CHAT_404"
fi

# --- Not found route ---
NF_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/nonexistent-route")
if [ "$NF_CODE" = "404" ]; then
  pass "Unknown route returns 404"
else
  fail "Unknown route — expected 404, got $NF_CODE"
fi

echo ""
echo "=== Phase 2: Chat endpoint (requires OPENROUTER_API_KEY) ==="
echo ""

if [ -n "${OPENROUTER_API_KEY:-}" ] && [ -n "$SESSION_ID" ]; then
  CHAT_RESP=$(curl -sf -X POST "$BASE/chat" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"Say hello in exactly one word.\"}" \
    --max-time 30 2>&1) || true

  CHAT_RESPONSE=$(echo "$CHAT_RESP" | jq -r '.response // empty' 2>/dev/null)
  if [ -n "$CHAT_RESPONSE" ]; then
    pass "POST /chat returns non-empty response"
  else
    fail "POST /chat — empty or invalid response: $CHAT_RESP"
  fi
else
  echo "  SKIP: OPENROUTER_API_KEY not set — chat test skipped"
fi

# --- Summary ---
echo ""
echo "=============================="
echo "  Results: $PASSED passed, $FAILED failed"
echo "=============================="

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi

exit 0
