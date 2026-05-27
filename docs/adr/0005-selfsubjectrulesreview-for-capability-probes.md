# SelfSubjectRulesReview for Capability Probes

Capability Probes use the Kubernetes `SelfSubjectRulesReview` API — a single call that returns all resource rules for a (user, namespace) pair — rather than `SelfSubjectAccessReview`, which checks one verb+resource combination per call.

k9s uses `SelfSubjectAccessReview` with an in-memory cache, checking permissions per-action (e.g., "can I delete this pod?"). knals takes a different approach because the use case is different: knals needs to know the full capability landscape for a namespace upfront, so it can grey out inaccessible resource types in the sidebar and Command Palette before the user tries anything.

## Considered Options

- **`SelfSubjectAccessReview` per-check (k9s model)**: authoritative — the authorizer evaluates exact policy for each query. But with 14 resource types × 2 verbs (list, get), that's ~28 API calls per namespace to build a full snapshot. For RBAC-restricted users on slow or metered connections to production clusters, this is expensive.
- **`SelfSubjectRulesReview` single-call (chosen)**: one round-trip per namespace returns all rules. The Kubernetes docs warn the result may be "incomplete" depending on the authorizer — wildcard or conditional rules may not fully materialize. For knals's read-only v1 scope (list + get verbs on standard resource types), the common RBAC configurations resolve correctly. If a permission is missed, the fallback is the same as today: the user selects the type and gets a 403, no worse than without a snapshot.

## Consequences

- One API call per namespace instead of ~28. Probe latency is bounded and predictable.
- The snapshot may underreport capabilities in exotic RBAC configurations. Greyed-out types are still selectable (by design) so the user can always try.
- Subresources (e.g., `pods/log`) are not included in the initial snapshot — they'll be added when log streaming is built.
