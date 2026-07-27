.DEFAULT_GOAL := help
COMPOSE := docker compose --profile prod
ADMIN_PHONE ?= +254700000000

.PHONY: help web up down restart logs ps smoke seed bootstrap dev dash app site build clean backup restore ml-setup ml-data ml-train ml-register ml-export ml-retrain

help: ## Show available targets
	@echo OpenWaste Intelligence — make targets:
	@echo   web        Build + start the backend platform (API :8000 + infrastructure)
	@echo   dash       Run the dashboard against the API (http://localhost:5174)
	@echo   app        Run the field PWA against the API (https://localhost:5173)
	@echo   site       Run the landing page (http://localhost:5175)
	@echo   up         Start without rebuilding
	@echo   down       Stop all services
	@echo   restart    Restart app services (api, worker, scheduler)
	@echo   logs       Tail logs from all services
	@echo   ps         Show service status
	@echo   build      Build images only
	@echo   smoke      Run the end-to-end smoke suite (needs PASSWORD=...)
	@echo   seed       Load a realistic demo dataset (needs PASSWORD=...)
	@echo   bootstrap  Sync the admin login from .env (OWI_ADMIN_PHONE / OWI_ADMIN_PASSWORD)
	@echo   backup     Run an immediate backup (db dump + image mirror)
	@echo   restore    Restore the latest db dump (DESTRUCTIVE, needs CONFIRM=yes)
	@echo   dev        Print source dev-server commands
	@echo   clean      Stop and remove volumes (DESTROYS local data)

# Frontends are not containerised: they build and run outside Docker and talk to
# this API over HTTP. Start them with `make dash` / `make app` / `make site`.
web:
	$(COMPOSE) up -d --build
	@echo api          http://localhost:8000
	@echo label studio http://localhost:8080
	@echo frontends    make dash ^| make app ^| make site

dash: ## Run the dashboard dev server against the API
	cd dash && pnpm install && pnpm dev

app: ## Run the field PWA dev server against the API
	cd app && pnpm install && pnpm dev

site: ## Run the landing page dev server
	cd site && pnpm install && pnpm dev

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
	@echo cd api  ^&^& uv run uvicorn owi_api.main:app --reload
	@echo cd dash ^&^& pnpm dev   ^(or: make dash^)
	@echo cd app  ^&^& pnpm dev   ^(or: make app^)
	@echo cd site ^&^& pnpm dev   ^(or: make site^)

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
