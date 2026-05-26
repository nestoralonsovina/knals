# TypeScript test infrastructure over bash

The test environment (kind cluster lifecycle, manifest application, kubeconfig generation, e2e tests) uses TypeScript running on Bun instead of bash scripts. The `test/` directory at the repo root is a standalone Bun project with its own `package.json`.

Bash was the natural first choice — cluster setup is mostly shelling out to `kind` and `kubectl`. But the test environment needs to grow to support multiple RBAC personas (full-access, namespace-scoped, read-only) coexisting on a single kind cluster, each with its own ServiceAccount, kubeconfig, and expected behavior. Orchestrating that in bash means parsing kubectl output, managing parallel state, and writing assertions by hand. TypeScript with `@kubernetes/client-node` gives typed access to the Kubernetes API for in-cluster operations, while still shelling out to `kind` for cluster create/delete (no JS SDK exists). `bun:test` provides the test runner with lifecycle hooks for setup/teardown.

The cluster is long-lived — started explicitly via `bun run cluster:up`, torn down via `bun run cluster:down`. Tests assume the cluster exists and fail fast if not. This avoids paying ~30s of cluster creation on every test run during development.

## Considered options

- **Bash scripts (status quo)**: simple for single-persona setup, but poor composability for multi-persona orchestration. No type safety, assertion libraries, or structured error handling.
- **TypeScript + `@kubernetes/client-node` + `bun:test` (chosen)**: Bun is already a project dependency (TUI, SDK, build). Typed k8s API access for resource creation and kubeconfig generation. `bun:test` is zero-config. Tradeoff: more setup than bash for simple cases.
- **TypeScript + kubectl subprocess only**: avoids the `@kubernetes/client-node` dependency but means parsing text output and losing type safety for the operations that matter most (RBAC setup, token extraction, assertions).

## Consequences

- `test/` has its own `package.json` with `@kubernetes/client-node` as a dependency.
- No Makefile — `package.json` scripts are the entrypoint (`cluster:up`, `cluster:down`, `cluster:reset`, `test`).
- `kind` is invoked via `Bun.spawn` / `child_process` — it remains a system dependency alongside Docker.
- Flat script files in `test/scripts/` (one per command), not a CLI framework.
