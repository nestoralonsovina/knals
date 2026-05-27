import { createSignal, createResource, createMemo, Match, Show, Switch, For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { checkHealth, getClusters, getResourcesTypes, client } from "@knals/sdk"
import type { Cluster } from "@knals/sdk"
import { createRouteState } from "./state"
import { ClustersScreen } from "./screens/clusters"
import { NamespacesScreen } from "./screens/namespaces"
import { ResourcesScreen } from "./screens/resources"
import { useCommandPalette, paletteOpen } from "./hooks/useCommandPalette"
import { buildRegistry } from "./lib/commands"

const SERVER_URL = process.env.KNALS_SERVER_URL ?? "http://localhost:8080"

client.setConfig({ baseUrl: SERVER_URL })

const state = createRouteState()

export const route = state.route
export const navigateTo = state.navigateTo
export const goBack = state.goBack
export const breadcrumb = state.breadcrumb

export function _resetRouteState() {
  state.navigateTo({ screen: "clusters" })
}

const [resourceTypes, setResourceTypes] = createSignal<string[]>([])

export { resourceTypes }

async function fetchResourceTypes() {
  try {
    const result = await getResourcesTypes()
    const types = (result.data as any[] | undefined) ?? []
    setResourceTypes(types.map((t: any) => t.name))
  } catch {
    setResourceTypes(["pods", "deployments", "services"])
  }
}

fetchResourceTypes()

export function App() {
  const dims = useTerminalDimensions()
  const [health] = createResource(() => checkHealth(SERVER_URL))
  const [clusters] = createResource(async () => {
    const result = await getClusters()
    return result.data ?? []
  })

  const registry = createMemo(() => buildRegistry(resourceTypes()))
  const palette = useCommandPalette(registry)

  useKeyboard((key) => {
    if (palette.handleKey(key)) return

    if (key.name === "escape" || key.name === "backspace") {
      if (route().screen === "namespaces") goBack()
    }
    if (key.name === "q") {
      process.stdout.write("\x1b[?1049l\x1b[?25h\x1b[0m\x1b[?1003l\x1b[?1002l\x1b[?1000l\x1b[?1006l\x1b[?2004l")
      process.exit(0)
    }
  })

  const statusText = () => {
    const h = health()
    if (health.loading) return "connecting..."
    if (!h || !h.ok) return `connection failed: ${h?.error ?? "unknown"}`
    return `connected to knals-server at ${SERVER_URL}`
  }

  const statusColor = () => {
    const h = health()
    if (health.loading) return "#eab308"
    if (!h || !h.ok) return "#ef4444"
    return "#22c55e"
  }

  const helpText = () => {
    const r = route()
    switch (r.screen) {
      case "clusters":
        return "j/k navigate  Enter select  : commands  q quit"
      case "namespaces":
        return "j/k navigate  Enter select  /:filter  a add  r discover  : commands  Esc back  q quit"
      case "resources":
        return ""
    }
  }

  const paletteW = () => Math.max(30, Math.floor(dims().width * 0.6))
  const paletteLeft = () => Math.floor((dims().width - paletteW()) / 2)
  const paletteMaxH = () => Math.min(16, dims().height - 4)
  const paletteTop = () => Math.max(1, Math.floor(dims().height * 0.15))

  return (
    <box
      flexDirection="column"
      width={dims().width}
      height={dims().height}
      backgroundColor="#0f0f23"
    >
      <Switch>
        <Match when={route().screen === "clusters"}>
          <ClustersScreen clusters={clusters() as Cluster[] | undefined} />
        </Match>
        <Match when={route().screen === "namespaces" && route() as { screen: "namespaces"; cluster: string }}>
          {(r) => <NamespacesScreen cluster={r().cluster} registry={registry} />}
        </Match>
        <Match when={route().screen === "resources" && route() as { screen: "resources"; cluster: string; namespace: string; initialType?: string }}>
          {(r) => (
            <ResourcesScreen
              cluster={r().cluster}
              namespace={r().namespace}
              initialType={r().initialType}
              registry={registry}
            />
          )}
        </Match>
      </Switch>

      <Show when={route().screen !== "resources"}>
        <box height={1} flexDirection="row" alignItems="center" padding={1} gap={2}>
          <text content={statusText()} fg={statusColor()} />
          <text content={helpText()} fg="#64748b" />
        </box>
      </Show>

      <Show when={paletteOpen()}>
        <box
          position="absolute"
          top={paletteTop()}
          left={paletteLeft()}
          width={paletteW()}
          height={Math.min(paletteMaxH(), palette.results().length + 3)}
          backgroundColor="#1a1a2e"
          border={true}
          borderStyle="rounded"
          borderColor="#3b82f6"
          flexDirection="column"
        >
          <box height={1} paddingLeft={1} flexDirection="row">
            <text content=": " fg="#3b82f6" />
            <text content={`${palette.input()}█`} fg="#e2e8f0" />
          </box>
          <box height={1} backgroundColor="#2d3555" />
          <box flexDirection="column" flexGrow={1}>
            <For each={palette.results().slice(0, paletteMaxH() - 3)}>
              {(match, i) => {
                const isSel = () => i() === palette.cursor()
                const fg = () => !match.available ? "#475569" : isSel() ? "#f8fafc" : "#e2e8f0"
                return (
                  <box height={1} paddingLeft={1} paddingRight={1} backgroundColor={isSel() ? "#1e3a5f" : "#1a1a2e"} flexDirection="row">
                    <text content={match.command.label} fg={fg()} />
                    <box flexGrow={1} />
                    <Show when={match.command.shortcut}>
                      <text content={match.command.shortcut!} fg="#475569" />
                    </Show>
                    <Show when={!match.available && match.reason}>
                      <text content={` (${match.reason})`} fg="#475569" />
                    </Show>
                  </box>
                )
              }}
            </For>
          </box>
          <box height={1} paddingLeft={1} backgroundColor="#111827">
            <text content={palette.showAll() ? "Tab: hide unavailable" : "Tab: show all"} fg="#475569" />
          </box>
        </box>
      </Show>
    </box>
  )
}
