.PHONY: dev-server dev-tui openapi build test test-all native start cluster-up cluster-down

dev-server:
	@./mvnw -pl knals-server quarkus:dev

dev-tui:
	@bun --cwd packages/tui dev

openapi:
	@./mvnw install -DskipTests -q
	@cp knals-server/target/openapi/openapi.json openapi.json
	@bun run --cwd packages/sdk generate
	@echo "OpenAPI spec and SDK regenerated"

build:
	@./mvnw install -DskipTests
	@bun run build

test:
	@./mvnw test
	@bun run --cwd packages/tui test

test-all: test
	@bun run test
	@cd test && bun run test:ci

native:
	@./mvnw package -Pnative -DskipTests -pl knals-server

start:
	@./mvnw install -DskipTests -q
	@bun --cwd packages/launcher src/index.ts

cluster-up:
	@cd test && bun run cluster:up

cluster-down:
	@cd test && bun run cluster:down
