export APP_UID := $(shell id -u)
export APP_GID := $(shell id -g)

.PHONY: run down logs test build dev

run:
	mkdir -p data
	docker compose up -d --build --wait
	@docker compose port web 3000 | sed 's/^127.0.0.1:/softtype: http:\/\/localhost:/'

down:
	docker compose down

logs:
	docker compose logs -f

test:
	npm test

build:
	npm run build

dev:
	npm run dev
