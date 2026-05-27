# CLAUDE.md

## Build & run

```bash
make dev-server          # Quarkus dev mode (live reload)
make dev-tui             # TUI dev mode
make start               # Build server + launch server + TUI together
make openapi             # Regenerate openapi.json + SDK from server
make build               # Full Maven + Bun build
make native              # GraalVM native binary (requires GraalVM or Docker)
make dist                # Build compiled knals binary (requires native first)
make cluster-up          # kind test cluster with RBAC personas + sample resources
make cluster-down        # Tear down kind cluster
```

## Test commands

```bash
make test                # Fast tests (Maven unit + TUI unit) — no cluster needed
make test-all            # All tests including E2E and cluster integration

# Individual suites:
./mvnw test                                              # Java: 29 tests
bun test --cwd packages/tui test/                        # TUI: 20 tests (exclude hunk/ submodule)
bun test --cwd packages/launcher                         # Launcher: 15 tests
bun test --cwd packages/e2e src/smoke.test.ts src/namespaces.test.ts src/resources.test.ts  # E2E (no cluster)
bun test --cwd packages/e2e src/cluster.test.ts          # Cluster integration (requires kind)
```

**IMPORTANT: TUI tests must specify `test/` directory** — running `bun test` in the TUI package without a path filter picks up the `hunk/` submodule tests which will fail.

## E2E testing requirements

E2E tests in `packages/e2e/` fall into two categories:

### Fast E2E (no cluster needed)
Files: `smoke.test.ts`, `namespaces.test.ts`
These start the JVM server, test endpoints, and don't need a Kubernetes cluster.

### Cluster E2E (requires `make cluster-up`)
Files: `cluster.test.ts`, any test using `kubeconfigPath()` or `isClusterRunning()`
These test against the real kind cluster with RBAC personas.

**When adding new E2E tests for any endpoint that calls the Kubernetes API, always test against the real kind cluster.** Do not use fake context names like `test-ctx` — these silently pass without validating real behavior. Follow the pattern in `cluster.test.ts`:

```typescript
beforeAll(async () => {
  if (!isClusterRunning()) await clusterUp()
  const kubeconfig = kubeconfigPath("full-access") // or "namespace-only", "read-only"
  const server = await startServer({ env: { KUBECONFIG: kubeconfig } })
  client.setConfig({ baseUrl: server.url })
}, 300_000)
```

### Test cluster resources

The kind cluster (`make cluster-up`) deploys resources across 3 namespaces:
- **team-api**: 2 deployments (gateway, user-service), 2 services, standalone pods (cache-warmer, debug-tools), 1 job, 1 cronjob, 1 configmap, 1 secret, 1 ingress
- **team-billing**: deployments, services, configmap
- **team-infra**: deployments, services, configmap

### RBAC personas (kubeconfigs in `test/kubeconfigs/`)
- **full-access**: cluster-admin, can do everything
- **namespace-only**: read access in team-api and team-infra, cannot LIST namespaces at cluster scope
- **read-only**: read access in team-api only
- **mixed-permissions**: specific resource/verb combinations

### Missing E2E test coverage (tracked in issues)

- **#23**: Resource listing against real cluster — verify pods, deployments, services actually return data with correct shape
- **#24**: Namespace discovery against real cluster — verify full-access discovers namespaces, namespace-only gets graceful fallback
- **#25**: KubeResult error codes — verify 403 for RBAC-restricted, 404 for not found, 502 for unreachable

## Architecture

Single-binary Kubernetes TUI for RBAC-restricted clusters.

- **Backend**: Quarkus 3.33 + fabric8 kubernetes-client (Java 21)
- **Frontend**: OpenTUI + Solid.js (TypeScript/Bun)
- **SDK**: Generated from OpenAPI spec via @hey-api/openapi-ts
- **Pipeline**: Server → OpenAPI spec → SDK → TUI

OpenAPI spec is the contract. CI validates it stays in sync. Run `make openapi` after any endpoint change.

## Key patterns

- **KubeResult<T>**: All `KubernetesService` methods return `KubeResult<T>` (sealed interface with Success/Forbidden/NotFound/Unreachable). Callers pattern-match to return proper HTTP status codes.
- **ResourceTypeInfo**: Single registry of resource types. `GET /resources/types` exposes the catalog. TUI fetches at startup.
- **Namespace Memory**: JSON persistence in `~/.config/knals/` (configurable via `KNALS_CONFIG_DIR`).
- **Table API**: Resource listing uses K8s Table API for server-computed columns — backend is a thin proxy.
- **Polling**: TUI polls resource list every 2s. Silent update, errors in status bar.

## Domain glossary

See `CONTEXT.md` for canonical terms: Cluster, Namespace Memory, Capability Snapshot, Probe.
