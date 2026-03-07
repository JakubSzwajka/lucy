# ============================================================================
# Lucy Gateway — Makefile
# ============================================================================

sinclude .env
export

IMAGE := lucy-gateway
PORT  := 3080

# ----------------------------------------------------------------------------
# Guard macros
# ----------------------------------------------------------------------------

# Fail if OPENROUTER_API_KEY is not set
check-env-KEY = @test -n "$$OPENROUTER_API_KEY" || \
	(echo "ERROR: OPENROUTER_API_KEY is not set. Export it or add to .env" && exit 1)

# Fail if a required CLI tool is missing
# Usage: $(call require-cmd,<binary>,<install hint>)
define require-cmd
	@command -v $(1) >/dev/null 2>&1 || \
		(echo "ERROR: '$(1)' not found. Install: $(2)" && exit 1)
endef

# ----------------------------------------------------------------------------
# Targets
# ----------------------------------------------------------------------------

.PHONY: help docker-build docker-run deploy deploy-secrets

## help — show this help (default)
help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## /  /'
	@echo ""

## docker-build — build the lucy-gateway Docker image
docker-build:
	@echo "Building $(IMAGE)..."
	docker build -t $(IMAGE) .

## docker-run — run lucy-gateway locally (requires OPENROUTER_API_KEY)
docker-run:
	$(check-env-KEY)
	@echo "Running $(IMAGE) on port $(PORT)..."
	docker run --rm -p $(PORT):$(PORT) \
		-e OPENROUTER_API_KEY \
		-e PORT=$(PORT) \
		$(IMAGE)

## deploy — set secrets and deploy to Railway (requires railway CLI + OPENROUTER_API_KEY)
deploy:
	$(call require-cmd,railway,https://docs.railway.app/guides/cli)
	$(check-env-KEY)
	@echo "Setting Railway secrets..."
	railway variables set OPENROUTER_API_KEY=$$OPENROUTER_API_KEY
	@echo "Deploying to Railway..."
	railway up

## deploy-secrets — set Railway secrets only (no deploy)
deploy-secrets:
	$(call require-cmd,railway,https://docs.railway.app/guides/cli)
	$(check-env-KEY)
	@echo "Setting Railway secrets..."
	railway variables set OPENROUTER_API_KEY=$$OPENROUTER_API_KEY
	@echo "Secrets set."
