.DEFAULT_GOAL := help
COMPOSE := docker compose --profile prod
ADMIN_PHONE ?= +254700000000

.PHONY: help web front up down restart logs ps smoke seed bootstrap dev dash app site build clean backup restore ml-setup ml-data ml-train ml-register ml-export ml-retrain

# make runs these through cmd.exe or sh depending on where it was invoked. Only
# plain text survives both — no parens, ampersands or pipes — and sh's echo eats
# repeated spaces, so single-space "name - description" is the one stable format.
help: ## Show available targets
	@echo OpenWaste Intelligence - make targets:
	@echo web - Build + start the backend, API :8000 plus infrastructure
	@echo front - Run all three frontends together: site, dash, app
	@echo dash - Run the dashboard alone on http://localhost:5174
	@echo app - Run the field PWA alone on https://localhost:5173
	@echo site - Run the landing page alone on http://localhost:5175
	@echo up - Start without rebuilding
	@echo down - Stop all services
	@echo restart - Restart api, worker, scheduler
	@echo logs - Tail logs from all services
	@echo ps - Show service status
	@echo build - Build images only
	@echo smoke - Run the end-to-end smoke suite, needs PASSWORD=...
	@echo seed - Load a realistic demo dataset, needs PASSWORD=...
	@echo bootstrap - Sync the admin login from .env
	@echo backup - Run an immediate backup, db dump plus image mirror
	@echo restore - Restore the latest db dump. DESTRUCTIVE, needs CONFIRM=yes
	@echo dev - Print source dev-server commands
	@echo clean - Stop and remove volumes. DESTROYS local data


web:
	$(COMPOSE) up -d --build
	@echo api          http://localhost:8000
	@echo label studio http://localhost:8080
	@echo frontends    make front

front: ## Run site + dash + app together, one Ctrl-C stops all three
	node scripts/frontends.mjs

dash: ## Run the dashboard dev server alone
	node scripts/frontends.mjs dash

app: ## Run the field PWA dev server alone
	node scripts/frontends.mjs app

site: ## Run the landing page dev server alone
	node scripts/frontends.mjs site

up: ## Start without rebuilding
	$(COMPOSE) up -d

down: ## Stop all services
	$(COMPOSE) down

restart: ## Restart app services
	$(COMPOSE) restart api worker scheduler

logs: ## Tail logs
	$(COMPOSE) logs -f

ps: ## Service status
	$(COMPOSE) ps

build: ## Build images only
	$(COMPOSE) build

smoke: ## Run the smoke suite against the running API
	cd api && uv run python scripts/smoke.py http://127.0.0.1:8000 $(ADMIN_PHONE) $(PASSWORD)

seed: ## Load a realistic demo dataset (idempotent; safe to re-run)
	cd api && uv run python scripts/seed.py http://127.0.0.1:8000 $(ADMIN_PHONE) $(PASSWORD)

bootstrap: ## Sync the admin login from .env (also runs automatically on every up)
	$(COMPOSE) exec api uv run python -m owi_api.bootstrap

backup: ## Run an immediate backup (db dump + image mirror)
	$(COMPOSE) exec db-backup /backup.sh
	$(COMPOSE) exec minio-backup mc mirror --overwrite --remove --exclude "quarantine/*" src/owi-images /backups/owi-images

restore: ## Restore the latest db dump (DESTRUCTIVE; requires CONFIRM=yes)
	@if [ "$(CONFIRM)" != "yes" ]; then echo "Run: make restore CONFIRM=yes"; exit 1; fi
	sh deploy/restore.sh --yes

dev: ## Print source dev-server commands
	@echo api        cd api, then uv run uvicorn owi_api.main:app --reload
	@echo frontends  make front - or make dash / make app / make site

clean: ## Stop and remove volumes (DESTROYS local data)
	$(COMPOSE) down -v

ml-setup: ## Install the ML training stack (PyTorch etc.)
	cd ml && uv sync --group train

ml-data: ## Download licensed public training data (TrashNet + Garbage Dataset v2, deduped)
	cd ml && uv run --group train python -m owi_ml.data.download

ml-train: ## Train the T2 material classifier on the merged corpus
	cd ml && uv run --group train python -m owi_ml.train.classify --data datasets/merged

ml-register: ## Publish + activate the trained model (API_URL, TOKEN, VERSION required)
	cd ml && uv run python -m owi_ml.registry --api $(API_URL) --token $(TOKEN) \
		--task classify --version $(VERSION) --onnx artifacts/classifier.onnx \
		--labels artifacts/labels.json --metrics artifacts/metrics.json

ml-export: ## Pull reviewed ground truth into datasets/safi (API_URL, TOKEN required)
	cd ml && uv run python -m owi_ml.data.export_reviewed --api $(API_URL) --token $(TOKEN)

ml-retrain: ## Weekly cadence: export reviews, retrain on public+local; register manually after checking the gate
	cd ml && uv run python -m owi_ml.data.export_reviewed --api $(API_URL) --token $(TOKEN)
	cd ml && uv run --group train python -m owi_ml.train.classify --data datasets/merged datasets/safi
