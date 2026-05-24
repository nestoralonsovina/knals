# knals

A personal Kubernetes TUI viewer designed for RBAC-restricted clusters where standard tools assume full access.

## Language

**Cluster**:
A connection to a Kubernetes API server, identified by a kubeconfig context name. Encompasses the server endpoint, user identity, and default namespace. Each Cluster owns a **Namespace Memory** and zero or more **Capability Snapshots**.
_Avoid_: context (overloaded with kubeconfig context and application context), connection, environment

**Namespace Memory**:
The per-**Cluster** persisted set of namespaces the user has access to. Populated by listing namespaces (when RBAC permits) or by manual entry with validation. Survives across sessions.
_Avoid_: namespace list (ambiguous with the k8s LIST namespaces API call), namespace cache

**Capability Snapshot**:
The cached result of a `SelfSubjectRulesReview` for a (**Cluster**, namespace) pair. Records which resource types and verbs the current user can access in that namespace. Persisted across sessions; refreshed on demand via a **Probe**.
_Avoid_: RBAC cache, permissions, access rules

**Probe**:
The act of calling the Kubernetes `SelfSubjectRulesReview` API to discover the current user's capabilities in a namespace. Produces or refreshes a **Capability Snapshot**. Triggered on first namespace selection and on manual refresh.
_Avoid_: scan, discovery, check

## Example Dialogue

> **Dev**: "The user connected to their production cluster but can't see any namespaces."
> **Expert**: "That's expected — their RBAC doesn't allow listing namespaces. They need to add namespaces to the **Namespace Memory** manually. knals validates each one with a **Probe**."
>
> **Dev**: "They added `team-api` to the Namespace Memory. Now what?"
> **Expert**: "knals ran a **Probe** and created a **Capability Snapshot** for that namespace. It shows they can list Pods, Services, and ConfigMaps, but not Secrets. The TUI should only show those three resource types."
>
> **Dev**: "Their admin just granted them Secret access. How does knals pick that up?"
> **Expert**: "The **Capability Snapshot** is stale now. The user triggers a refresh — knals runs a new **Probe** and overwrites the old snapshot."
