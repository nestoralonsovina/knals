# knals

A personal Kubernetes TUI viewer designed for RBAC-restricted clusters where standard tools (like k9s) assume full access.

## Problem

In clusters with strict RBAC, users often cannot list namespaces or cluster-scoped resources. k9s requires `--namespace` as a CLI flag and offers no way to discover, remember, or adapt to what you actually have access to. knals handles this properly.

## Status

Pre-alpha. Architecture and API designed; implementation not started.

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
- **Packaging** — GraalVM `native-image` + `bun build --compile`. One binary ships.

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

## API

Per-resource typed endpoints. Each resource type has its own response model with kind-specific fields (pod phase, deployment replicas, etc.). SSE for watch streams and log streaming.

### Cluster management

```
GET  /clusters                                → list kubeconfig contexts
GET  /clusters/{ctx}                          → cluster details + connection status
```

### Namespace Memory

```
GET    /clusters/{ctx}/namespaces             → list remembered namespaces
POST   /clusters/{ctx}/namespaces             → add namespace (validates via probe)
DELETE /clusters/{ctx}/namespaces/{ns}         → remove from memory
```

### Capabilities

```
GET  /clusters/{ctx}/namespaces/{ns}/capabilities          → cached Capability Snapshot
POST /clusters/{ctx}/namespaces/{ns}/capabilities/refresh  → re-probe via SelfSubjectRulesReview
```

### Resources (per type: pods, deployments, services, ...)

```
GET  /clusters/{ctx}/namespaces/{ns}/pods                  → list pods
GET  /clusters/{ctx}/namespaces/{ns}/pods/{name}           → get single pod
GET  /clusters/{ctx}/namespaces/{ns}/pods/watch            → SSE stream (ADDED/MODIFIED/DELETED)
```

Repeat for each resource type: `deployments`, `replicasets`, `statefulsets`, `daemonsets`, `jobs`, `cronjobs`, `services`, `ingresses`, `configmaps`, `secrets`, `pvcs`, `serviceaccounts`, `events`.

### Logs

```
GET  /clusters/{ctx}/namespaces/{ns}/pods/{name}/logs              → log snapshot
GET  /clusters/{ctx}/namespaces/{ns}/pods/{name}/logs?follow=true  → SSE log stream
```

### Data flow

1. `GET .../pods` returns current state (snapshot).
2. `GET .../pods/watch` returns an SSE stream of ADDED / MODIFIED / DELETED events.

The TUI loads the snapshot first, then opens the watch stream for live updates.

## Planned layout

```
knals/
├── pom.xml                        # Maven parent
├── knals-server/
│   ├── pom.xml
│   └── src/main/java/             # Quarkus, JAX-RS, fabric8
├── knals-core/
│   ├── pom.xml
│   └── src/main/java/             # shared resource models
├── packages/
│   ├── tui/                       # @opentui/solid client
│   └── sdk/                       # generated TS client
├── openapi.json                   # generated via SmallRye OpenAPI
└── scripts/build.ts               # native-image + bun compile → single binary
```

## Dev setup

### Prerequisites

- JDK 21+ (GraalVM recommended)
- Maven 3.9+
- Bun
- Docker (for kind/k3d test clusters)

### Dev loop

- `./mvnw quarkus:dev -pl knals-server` — server with live reload
- `bun --cwd packages/tui dev` — TUI, reads `KNALS_SERVER_URL` from env

### Testing with mock clusters

Use kind or k3d for local clusters with custom RBAC:

```bash
kind create cluster --name knals-test
kubectl apply -f test/rbac/restricted-user.yaml
```

## Ideas borrowed from opencode

- **Routes as screens** (`pods`, `deployments`, `logs`) swapped by a tiny `RouteProvider`.
- **Mode-stack keymap** (`/` to filter, `:` to command, per-resource modes) so bindings are context-aware.
- **Dialog stack** for confirmations and prompts.
- **Command palette** as a first-class concept with fuzzy search.
- **OpenAPI as the single source of truth** between Java and TS — CI fails if the regenerated SDK drifts from the checked-in spec.

## Inspirations

- [k9s](https://github.com/derailed/k9s) — feature reference (the `upstream` remote)
- [opencode](https://github.com/anomalyco/opencode) — architecture reference
- [OpenTUI](https://github.com/sst/opentui) — UI framework

## License

TBD.
