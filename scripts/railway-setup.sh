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
railway add --database postgres -y 2>/dev/null || echo "[ok] Postgres may already exist — skipping."

echo ""

# ── 3. Backend service ──────────────────────────────────────────────────────

echo "[..] Adding backend service..."
railway add --service lucy-backend -y 2>/dev/null || echo "[ok] Service may already exist — skipping."

# Link to the backend service for subsequent commands
railway service lucy-backend 2>/dev/null || true

echo ""

# ── 4. Environment variables ────────────────────────────────────────────────

echo "[..] Setting environment variables..."

# Core config — DATABASE_URL is auto-injected by Railway's Postgres plugin
# via variable reference, but we set the provider explicitly.
railway variable set DATABASE_PROVIDER=postgres

# JWT secret — generate a random one if not provided
if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  echo "[!!] Generated random JWT_SECRET. Save it somewhere safe."
fi
railway variable set "JWT_SECRET=$JWT_SECRET"

# AI provider keys — only set if provided in environment
[ -n "${OPENAI_API_KEY:-}" ]                && railway variable set "OPENAI_API_KEY=$OPENAI_API_KEY"
[ -n "${ANTHROPIC_API_KEY:-}" ]             && railway variable set "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
[ -n "${GOOGLE_GENERATIVE_AI_API_KEY:-}" ]  && railway variable set "GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY"

echo ""

# ── 5. Custom domain (optional) ────────────────────────────────────────────

echo "[..] Generating Railway domain..."
railway domain 2>/dev/null || echo "[ok] Domain may already exist — skipping."

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Connect your GitHub repo in the Railway dashboard (Settings → Source)"
echo "     Point the backend service to the /backend directory."
echo "  2. Or deploy manually:  cd backend && railway up"
echo "  3. Verify:  curl https://<your-domain>/api/health"
echo ""
