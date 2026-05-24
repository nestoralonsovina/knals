# RBAC-first architecture

knals assumes the user may lack cluster-wide permissions — for example, cannot list namespaces. Instead of failing or requiring CLI flags (as k9s does), knals maintains a **Namespace Memory** per cluster and a **Capability Snapshot** per (cluster, namespace) via `SelfSubjectRulesReview`. The UI adapts to what the user can actually do, greying out inaccessible resource types rather than showing 403 errors after the fact.

Capability Snapshots are persisted across sessions so that reconnecting to a known cluster is instant — no re-probing on every startup.

## Considered Options

- **Assume full access (k9s model)**: simpler, but this is the exact problem knals exists to solve.
- **Reactive 403 handling**: let the user try anything, surface errors nicely. Simpler backend, but poor UX — you keep hitting walls you could have been warned about.
- **Prescient + session-only cache**: probe on each session start, don't persist. Less state, but slower reconnect and loses the "knals remembers your namespaces" property.
- **Prescient + persisted (chosen)**: best UX for the primary use case (same user, same clusters, repeated sessions). Tradeoff is staleness — if cluster RBAC changes, the snapshot must be manually refreshed.
