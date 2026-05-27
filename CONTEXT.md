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

**Command Registry**:
The static array of all user-invocable actions in the TUI. Each entry declares a label, an optional keyboard shortcut, declarative availability requirements, and an execute function. Consumed by both the **Command Palette** and the keyboard handler — single source of truth, no duplicate wiring.
_Avoid_: command list, action map, keybinding config

**Command Palette**:
A fuzzy-search overlay triggered by `:` that lets users discover and execute commands from the **Command Registry**. Context-sensitive — available commands change based on current screen, selected resource type, and selection state. Unavailable commands are hidden by default; toggled visible with `Tab`.
_Avoid_: command bar, command prompt, action menu

## Example Dialogue

> **Dev**: "The user connected to their production cluster but can't see any namespaces."
> **Expert**: "That's expected — their RBAC doesn't allow listing namespaces. They need to add namespaces to the **Namespace Memory** manually. knals validates each one with a **Probe**."
>
> **Dev**: "They added `team-api` to the Namespace Memory. Now what?"
> **Expert**: "knals ran a **Probe** and created a **Capability Snapshot** for that namespace. It shows they can list Pods, Services, and ConfigMaps, but not Secrets. The TUI should only show those three resource types."
>
> **Dev**: "Their admin just granted them Secret access. How does knals pick that up?"
> **Expert**: "The **Capability Snapshot** is stale now. The user triggers a refresh — knals runs a new **Probe** and overwrites the old snapshot."
>
> **Dev**: "How does the user navigate to Deployments without memorizing keybindings?"
> **Expert**: "They hit `:` to open the **Command Palette**, type `dep`, and select 'Go to Deployments'. The palette pulls from the **Command Registry**, so every action — including keyboard shortcuts — is discoverable in one place."
>
> **Dev**: "Can they see the 'View Logs' command from the Deployments list?"
> **Expert**: "No — the **Command Registry** entry for logs declares `resourceType: ['pods']`. The palette hides it unless a pod is selected. They can press `Tab` in the palette to reveal all commands and see why it's unavailable."
