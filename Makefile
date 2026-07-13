.DEFAULT_GOAL := help
COMPOSE := docker compose --profile prod
ADMIN_PHONE ?= +254700000000

.PHONY: help web up down restart logs ps smoke bootstrap dev build clean ml-setup ml-data ml-train ml-register

help: ## Show available targets
	@echo OpenWaste Intelligence — make targets:
	@echo   web        Build + start the whole platform (dashboard :8443, field app :8444)
	@echo   up         Start without rebuilding
	@echo   down       Stop all services
	@echo   restart    Restart app services (api, worker, scheduler, web)
	@echo   logs       Tail logs from all services
	@echo   ps         Show service status
	@echo   build      Build images only
	@echo   smoke      Run the end-to-end smoke suite (needs PASSWORD=...)
	@echo   bootstrap  Create first org + admin (ORG, NAME, PHONE, PASSWORD)
	@echo   dev        Print source dev-server commands
	@echo   clean      Stop and remove volumes (DESTROYS local data)

web: ## Build + start the whole platform
	$(COMPOSE) up -d --build
	@echo dashboard    https://localhost:8443
	@echo field app    https://localhost:8444
	@echo label studio http://localhost:8080
	@echo (accept the self-signed certificate once per device)

up: ## Start without rebuilding
	$(COMPOSE) up -d

down: ## Stop all services
	$(COMPOSE) down

restart: ## Restart app services
	$(COMPOSE) restart api worker scheduler web

logs: ## Tail logs
	$(COMPOSE) logs -f

ps: ## Service status
	$(COMPOSE) ps

build: ## Build images only
	$(COMPOSE) build

smoke: ## Run the smoke suite against the running API
	cd api && uv run python scripts/smoke.py http://127.0.0.1:8000 $(ADMIN_PHONE) $(PASSWORD)

bootstrap: ## Create first org + admin
	$(COMPOSE) exec api uv run python -m owi_api.bootstrap --org "$(ORG)" --name "$(NAME)" --phone "$(PHONE)" --password "$(PASSWORD)"

dev: ## Print source dev-server commands
	@echo cd api  ^&^& uv run uvicorn owi_api.main:app --reload
	@echo cd dash ^&^& pnpm dev
	@echo cd app  ^&^& pnpm dev

clean: ## Stop and remove volumes (DESTROYS local data)
	$(COMPOSE) down -v

ml-setup: ## Install the ML training stack (PyTorch etc.)
	cd ml && uv sync --group train

ml-data: ## Download public training data (TrashNet)
	cd ml && uv run --group train python -m owi_ml.data.download

ml-train: ## Train the T2 material classifier on downloaded data
	cd ml && uv run --group train python -m owi_ml.train.classify --data datasets/trashnet

ml-register: ## Publish + activate the trained model (API_URL, TOKEN, VERSION required)
	cd ml && uv run python -m owi_ml.registry --api $(API_URL) --token $(TOKEN) \
		--task classify --version $(VERSION) --onnx artifacts/classifier.onnx \
		--labels artifacts/labels.json --metrics artifacts/metrics.json
