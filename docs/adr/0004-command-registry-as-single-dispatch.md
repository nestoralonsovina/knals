# Command registry as single dispatch for palette and keybindings

A static **Command Registry** (`lib/commands.ts`) is the single source of truth for all user-invocable actions. Each entry declares a label, an optional keyboard shortcut, declarative availability requirements, and an execute function. The **Command Palette** (fuzzy overlay triggered by `:`) reads the registry to show/filter commands. The keyboard handler reads it to dispatch shortcut keys. Both resolve from the same array — there is no second place to wire an action.

Navigational keys (j/k, Enter for row selection, Tab for pane cycling, Esc cascade) stay outside the registry. They are spatial movement, not commands.

## Considered Options

- **Separate wiring**: palette has its own command list, keyboard handler has its own `if/switch` chains (the pre-palette status quo). Simpler initially, but every new feature must be wired in two places — drift is inevitable.
- **Reactive registry**: a `createMemo` that recomputes available commands when context changes. Unnecessary overhead — the registry is static data, and availability filtering happens only when the palette opens.
- **Single static registry (chosen)**: one array, two consumers. Zero-drift by construction. The trade-off is that every action must fit the registry's shape (id, label, shortcut, requirements, execute) — but that constraint is a feature, not a limitation.

## Consequences

- `useKeyboardDispatch` shrinks to spatial navigation only. Action dispatch loops over the registry matching `shortcut` + `requires` against current context.
- Adding a new command is a single registry entry — palette visibility, keyboard shortcut, and availability checks come for free.
- The declarative `requires` shape (`{ screen, resourceType?, needsSelection? }`) must cover all availability conditions. An optional `available` predicate escape hatch exists for edge cases.
