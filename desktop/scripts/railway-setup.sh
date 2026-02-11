#!/usr/bin/env bash
#
# Railway infrastructure setup for Lucy backend.
#
# Prerequisites:
#   - Railway CLI installed: npm i -g @railway/cli
#   - Authenticated: railway login (or set RAILWAY_API_TOKEN)
#
# Usage:
#   ./scripts/railway-setup.sh              # Interactive (picks/creates project)
#   RAILWAY_API_TOKEN=xxx ./scripts/railway-setup.sh  # CI/CD non-interactive
#
set -euo pipefail

echo "=== Lucy — Railway Setup ==="
echo ""

# ── 1. Project ──────────────────────────────────────────────────────────────

if railway status &>/dev/null; then
  echo "[ok] Already linked to a Railway project."
  railway status
else
  echo "[..] No project linked. Creating a new one..."
  railway init
fi

echo ""

# ── 2. PostgreSQL database ──────────────────────────────────────────────────

echo "[..] Adding PostgreSQL database..."
railway add --database postgres || echo "[ok] Postgres may already exist — skipping."

echo ""

# ── 3. Backend service with variables ───────────────────────────────────────

# JWT secret — generate a random one if not provided
if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  echo "[!!] Generated random JWT_SECRET. Save it somewhere safe:"
  echo "     $JWT_SECRET"
fi

echo "[..] Adding backend service with environment variables..."
VARS=(
  --variables "DATABASE_PROVIDER=postgres"
  --variables "JWT_SECRET=$JWT_SECRET"
)

# AI provider keys — only include if provided in environment
[ -n "${OPENAI_API_KEY:-}" ]                && VARS+=(--variables "OPENAI_API_KEY=$OPENAI_API_KEY")
[ -n "${ANTHROPIC_API_KEY:-}" ]             && VARS+=(--variables "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
[ -n "${GOOGLE_GENERATIVE_AI_API_KEY:-}" ]  && VARS+=(--variables "GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY")

railway add --service lucy-backend "${VARS[@]}" || echo "[ok] Service may already exist — skipping."

echo ""

# ── 4. Link to backend service ──────────────────────────────────────────────

echo "[..] Linking to lucy-backend service..."
railway service link lucy-backend

echo ""

# ── 5. Generate domain ─────────────────────────────────────────────────────

echo "[..] Generating Railway domain..."
railway domain || echo "[ok] Domain may already exist — skipping."

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Get your Railway project token: railway login → Dashboard → Project → Settings → Tokens"
echo "  2. Add it as a GitHub secret: repo → Settings → Secrets → RAILWAY_TOKEN"
echo "  3. Push to main — the deploy-backend workflow will build & deploy automatically."
echo "  4. Or deploy manually:  cd backend && railway up"
echo "  5. Verify:  curl https://<your-domain>/api/health"
echo ""
