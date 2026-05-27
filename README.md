# knals

A Kubernetes TUI viewer designed for RBAC-restricted clusters where standard tools (like k9s) assume full access.

## Problem

In clusters with strict RBAC, users often cannot list namespaces or cluster-scoped resources. k9s requires `--namespace` as a CLI flag and offers no way to discover, remember, or adapt to what you actually have access to. knals handles this properly.

## Install

macOS (Apple Silicon):

```bash
curl -fsSL https://raw.githubusercontent.com/nestoralonsovina/knals/main/install.sh | sh
```

Or download a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/nestoralonsovina/knals/main/install.sh | sh -s v0.1.0
```

The installer downloads the binary to `~/.knals/bin/` and offers to add it to your PATH.

## Architecture

Inspired by [opencode](https://github.com/anomalyco/opencode): headless HTTP server + thin TUI client + OpenAPI-generated SDK, packaged as a single binary.

```
┌──────────────────────────────────────────────┐
│ knals (single binary)                        │
│                                              │
│  ┌─────────────┐    HTTP/SSE    ┌─────────┐  │
│  │  OpenTUI    │ ◀────────────▶ │ Quarkus │  │
│  │   (Bun)     │   127.0.0.1    │ native  │  │
│  └─────────────┘                └────┬────┘  │
│                                      │       │
│                                  fabric8     │
└──────────────────────────────────────┼───────┘
                                       ▼
                                  Kubernetes
```

- **Server** — [Quarkus](https://quarkus.io/) + [fabric8 kubernetes-client](https://github.com/fabric8io/kubernetes-client), compiled to native binary via GraalVM. JAX-RS endpoints + [SmallRye OpenAPI](https://github.com/smallrye/smallrye-open-api) for spec generation. [Mutiny](https://smallrye.io/smallrye-mutiny/) for reactive SSE streams.
- **TUI** — Bun + [`@opentui/solid`](https://github.com/sst/opentui). Talks to the server only through the generated SDK — no in-process shortcuts — so `knals serve` / `knals attach <url>` modes fall out for free.
- **SDK** — TypeScript client generated from `openapi.json` via [`@hey-api/openapi-ts`](https://heyapi.dev/).
- **Packaging** — GraalVM `native-image` + `bun build --compile`. Distributed as a tarball via GitHub Releases.

## RBAC-first design

knals assumes the user may lack cluster-wide permissions. See [ADR-0001](docs/adr/0001-rbac-first-architecture.md).

### Namespace Memory

On connect, knals tries to list namespaces. If forbidden (403), it falls back to a per-cluster **Namespace Memory** — a persisted set of namespaces the user has declared access to. Add namespaces manually; knals validates each and remembers them across sessions.

### Capability Snapshots

When a namespace is selected, knals calls `SelfSubjectRulesReview` to discover exactly which resources and verbs the user can access. The result is persisted as a **Capability Snapshot**. The UI adapts — inaccessible resource types are greyed out rather than shown then 403'd. Snapshots are refreshed on demand.

See [CONTEXT.md](CONTEXT.md) for the full domain glossary.

## v1 scope

- **Read-only**: list, get, watch, logs. No write operations.
- **Namespaced resources only**: Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs, Services, Ingresses, ConfigMaps, Secrets, PVCs, ServiceAccounts, Events.
- **No cluster-scoped resources**: No Nodes, PVs, ClusterRoles, CRDs.

## Dev setup

### Prerequisites

- JDK 21+ (GraalVM or Mandrel recommended)
- Bun
- Docker (for kind test clusters)
- [kind](https://kind.sigs.k8s.io/)

### Commands

| Command | Description |
|---------|-------------|
| `make dev-server` | Start Quarkus server with live reload |
| `make dev-tui` | Start TUI in dev mode (reads `KNALS_SERVER_URL` from env) |
| `make start` | Build and run knals (uses your current kubeconfig) |
| `make start-profile` | Build and run with a test cluster profile selector |
| `make build` | Build all modules (Java + TypeScript) |
| `make test` | Run server and TUI tests |
| `make test-all` | Run all tests including e2e |
| `make native` | Build GraalVM native binary |
| `make dist` | Build full distribution (native + bundled TUI) |
| `make openapi` | Regenerate OpenAPI spec and SDK |
| `make cluster-up` | Create kind test cluster with RBAC personas |
| `make cluster-down` | Tear down test cluster |

### Test cluster

A kind cluster with multiple RBAC personas for development and e2e testing. See [ADR-0003](docs/adr/0003-typescript-test-infrastructure.md).

```bash
make cluster-up       # create cluster + apply manifests + generate kubeconfigs
make start-profile    # run knals with a profile selector (full-access, read-only, etc.)
make cluster-down     # tear down cluster
```

Available profiles: `full-access`, `namespace-only`, `read-only`, `mixed-permissions`.

## Project structure

```
knals/
├── pom.xml                        # Maven parent
├── knals-core/                    # shared resource models (Kotlin)
├── knals-server/                  # Quarkus JAX-RS + fabric8 (Kotlin)
├── packages/
│   ├── launcher/                  # binary packaging (Bun compile)
│   ├── tui/                       # @opentui/solid TUI client
│   ├── sdk/                       # generated TypeScript client
│   └── e2e/                       # e2e test utilities
├── test/                          # kind cluster + e2e tests
├── openapi.json                   # generated via SmallRye OpenAPI
└── install.sh                     # curl-to-shell installer
```

## Known limitations

The release tarball is ~53MB compressed (~138MB on disk). Most of this comes from two fixed costs:

- **Bun runtime** (~55MB) — `bun build --compile` embeds the entire Bun runtime. There's no slim mode yet ([tracking issue](https://github.com/oven-sh/bun/issues/14546)).
- **GraalVM native binary** (~74MB) — the fabric8 kubernetes-client registers hundreds of Kubernetes model classes for reflection, which GraalVM bakes into the binary.

A future simplification could drop the Java server entirely and talk to kubectl directly from the TypeScript TUI, cutting the binary roughly in half.

## Inspirations

- [k9s](https://github.com/derailed/k9s) — feature reference
- [opencode](https://github.com/anomalyco/opencode) — architecture reference
- [OpenTUI](https://github.com/sst/opentui) — UI framework

## License

MIT
