# ============================================================================
# Lucy Gateway — Makefile
# ============================================================================

sinclude .env
export

IMAGE       := lucy-gateway
PORT        := 3080

# ----------------------------------------------------------------------------
# Guard macros
# ----------------------------------------------------------------------------

# Fail if OPENROUTER_API_KEY is not set
check-env-KEY = @test -n "$$OPENROUTER_API_KEY" || \
	(echo "ERROR: OPENROUTER_API_KEY is not set. Export it or add to .env" && exit 1)

# Fail if PI_BRIDGE_MODEL is not set
check-env-MODEL = @test -n "$$PI_BRIDGE_MODEL" || \
	(echo "ERROR: PI_BRIDGE_MODEL is not set. Export it or add to .env" && exit 1)

# Fail if a required CLI tool is missing
# Usage: $(call require-cmd,<binary>,<install hint>)
define require-cmd
	@command -v $(1) >/dev/null 2>&1 || \
		(echo "ERROR: '$(1)' not found. Install: $(2)" && exit 1)
endef

# ----------------------------------------------------------------------------
# Targets
# ----------------------------------------------------------------------------

.PHONY: help dev up down logs docker-build docker-run deploy deploy-secrets

## help — show this help (default)
help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## /  /'
	@echo ""

## up — start gateway + webui via docker-compose (dev mode)
up:
	$(check-env-KEY)
	@echo "Starting all services..."
	docker compose up --build
	@echo ""
	@echo "  Gateway: http://localhost:$(PORT)"
	@echo "  WebUI:   http://localhost:$${WEBUI_PORT:-5173}"
	@echo ""

## down — stop all docker-compose services
down:
	docker compose down

## docker-build — build the lucy-gateway Docker image
docker-build:
	@echo "Building $(IMAGE)..."
	docker build -t $(IMAGE) .

## docker-run — run lucy-gateway locally (requires OPENROUTER_API_KEY + PI_BRIDGE_MODEL)
docker-run:
	$(check-env-KEY)
	$(check-env-MODEL)
	@echo "Running $(IMAGE) on port $(PORT)..."
	docker run --rm -p $(PORT):$(PORT) \
		-e OPENROUTER_API_KEY \
		-e PI_BRIDGE_MODEL \
		-e PORT=$(PORT) \
		$(IMAGE)

## deploy — set secrets and deploy to Railway (requires railway CLI + OPENROUTER_API_KEY + PI_BRIDGE_MODEL)
deploy:
	$(call require-cmd,railway,https://docs.railway.app/guides/cli)
	$(check-env-KEY)
	$(check-env-MODEL)
	@echo "Setting Railway variables..."
	railway variables set \
		OPENROUTER_API_KEY=$$OPENROUTER_API_KEY \
		PI_BRIDGE_MODEL=$$PI_BRIDGE_MODEL \
		AGENTS_DATA_DIR=/data \
		CORS_ORIGIN=$${CORS_ORIGIN:-*} \
		$${LUCY_API_KEY:+LUCY_API_KEY=$$LUCY_API_KEY} \
		PI_CODING_AGENT_DIR=/data/pi \
		$${PI_BRIDGE_PROVIDER:+PI_BRIDGE_PROVIDER=$$PI_BRIDGE_PROVIDER} \
		$${TELEGRAM_BOT_TOKEN:+TELEGRAM_BOT_TOKEN=$$TELEGRAM_BOT_TOKEN} \
		$${TELEGRAM_CHAT_ID:+TELEGRAM_CHAT_ID=$$TELEGRAM_CHAT_ID}
	@echo "Deploying to Railway..."
	railway up --no-gitignore

## deploy-secrets — set Railway secrets only (no deploy)
deploy-secrets:
	$(call require-cmd,railway,https://docs.railway.app/guides/cli)
	$(check-env-KEY)
	$(check-env-MODEL)
	@echo "Setting Railway variables..."
	railway variables set \
		OPENROUTER_API_KEY=$$OPENROUTER_API_KEY \
		PI_BRIDGE_MODEL=$$PI_BRIDGE_MODEL \
		AGENTS_DATA_DIR=/data \
		CORS_ORIGIN=$${CORS_ORIGIN:-*} \
		$${LUCY_API_KEY:+LUCY_API_KEY=$$LUCY_API_KEY} \
		PI_CODING_AGENT_DIR=/data/pi \
		$${PI_BRIDGE_PROVIDER:+PI_BRIDGE_PROVIDER=$$PI_BRIDGE_PROVIDER} \
		$${TELEGRAM_BOT_TOKEN:+TELEGRAM_BOT_TOKEN=$$TELEGRAM_BOT_TOKEN} \
		$${TELEGRAM_CHAT_ID:+TELEGRAM_CHAT_ID=$$TELEGRAM_CHAT_ID}
	@echo "Variables set."
