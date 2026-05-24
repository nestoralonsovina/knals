# knals

A personal Kubernetes TUI viewer — [k9s](https://github.com/derailed/k9s)-inspired, built with [OpenTUI](https://github.com/sst/opentui) and a Rust backend embedded into a single binary.

## Status

Pre-alpha. The repo is a skeleton; expect everything to change.

## Why

- I want a Kubernetes viewer tuned to my own workflow rather than yet another fork of k9s.
- I want to try OpenTUI (SolidJS-flavoured TUI) as the UI layer.
- I want a clean client/server split so the same backend can later drive a web UI, MCP server, or remote-attach flow — without re-implementing the Kubernetes plumbing per frontend.

## Architecture

Inspired by the [opencode](https://github.com/anomalyco/opencode) layout: **headless HTTP server + thin OpenTUI client + OpenAPI-generated SDK, packaged as a single binary**. opencode itself is now all-TypeScript on Bun, but the *shape* of its architecture translates cleanly to a Rust backend.

```
┌──────────────────────────────────────────────┐
│ knals (single binary)                        │
│                                              │
│  ┌─────────────┐    HTTP/SSE    ┌─────────┐  │
│  │  OpenTUI    │ ◀────────────▶ │  Rust   │  │
│  │   (Bun)     │   127.0.0.1    │ server  │  │
│  └─────────────┘                └────┬────┘  │
│                                      │       │
│                                  kube-rs     │
└──────────────────────────────────────┼───────┘
                                       ▼
                                  Kubernetes
```

- **Server** — Rust, [`axum`](https://github.com/tokio-rs/axum) + [`kube-rs`](https://github.com/kube-rs/kube). JSON HTTP API plus SSE streams for watches and `logs -f`. OpenAPI spec generated from route definitions via [`utoipa`](https://github.com/juhaku/utoipa) and checked in.
- **TUI** — Bun + [`@opentui/solid`](https://github.com/sst/opentui). Talks to the local server only through the generated SDK — no in-process shortcuts — so `knals serve` / `knals attach <url>` modes fall out for free.
- **SDK** — TypeScript client generated from `openapi.json` via [`@hey-api/openapi-ts`](https://heyapi.dev/).
- **Packaging** — `bun build --compile` produces a TUI binary; the Rust crate `include_bytes!`s it and supervises both at runtime. One file ships.

## Planned layout

```
knals/
├── Cargo.toml             # cargo workspace
├── crates/
│   ├── knals-server/      # axum + kube-rs + utoipa
│   └── knals-core/        # shared resource model
├── packages/
│   ├── tui/               # @opentui/solid client
│   └── sdk/               # generated TS client
├── openapi.json           # source of truth, regenerated from server routes
└── scripts/build.ts       # bun compile + cargo build → single binary
```

## Dev loop

- `cargo watch -x 'run -p knals-server'` — server on a known local port
- `bun --cwd packages/tui dev` — TUI, reads `KNALS_SERVER_URL` from env
- Release: one binary, no runtime dependencies

## Ideas borrowed from opencode

- **Routes as screens** (`pods`, `nodes`, `logs`, `describe`) swapped by a tiny `RouteProvider`.
- **Mode-stack keymap** (`/` to filter, `:` to command, per-resource modes) so bindings are context-aware.
- **Dialog stack** for confirmations, exec prompts, YAML-edit guards.
- **Command palette** as a first-class concept with fuzzy search.
- **OpenAPI as the single source of truth** between Rust and TS — CI fails if the regenerated SDK drifts from the checked-in handlers.

## Inspirations

- [k9s](https://github.com/derailed/k9s) — feature reference (the `upstream` remote of this repo)
- [opencode](https://github.com/anomalyco/opencode) — architecture reference
- [OpenTUI](https://github.com/sst/opentui) — UI framework

## License

TBD.
