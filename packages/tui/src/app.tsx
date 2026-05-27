import { createSignal, createResource, Match, Switch } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { checkHealth, getClusters, client } from "@knals/sdk"
import type { Cluster } from "@knals/sdk"
import { createRouteState, type Route } from "./state"
import { ClustersScreen } from "./screens/clusters"
import { NamespacesScreen } from "./screens/namespaces"
import { ResourcesScreen } from "./screens/resources"
import { DetailScreen } from "./screens/detail"

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

export function App() {
  const dims = useTerminalDimensions()
  const [health] = createResource(() => checkHealth(SERVER_URL))
  const [clusters] = createResource(async () => {
    const result = await getClusters()
    return result.data ?? []
  })

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "backspace") {
      if (route().screen === "clusters") return
      goBack()
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
        return "j/k navigate  Enter select  q quit"
      case "namespaces":
        return "j/k navigate  Enter select  a add  d delete  r discover  Esc back  q quit"
      case "resources":
        return "j/k navigate  h/l switch type  Enter detail  Esc back  q quit"
      case "detail":
        return "j/k scroll  g top  Esc back  q quit"
    }
  }

  return (
    <box
      flexDirection="column"
      width={dims().width}
      height={dims().height}
      backgroundColor="#0f0f23"
    >
      <box
        height={3}
        border={true}
        borderStyle="rounded"
        borderColor="#3b82f6"
        flexDirection="row"
        alignItems="center"
        padding={1}
      >
        <text content={breadcrumb()} fg="#3b82f6" />
      </box>

      <Switch>
        <Match when={route().screen === "clusters"}>
          <ClustersScreen clusters={clusters() as Cluster[] | undefined} />
        </Match>
        <Match when={route().screen === "namespaces" && route() as { screen: "namespaces"; cluster: string }}>
          {(r) => <NamespacesScreen cluster={r().cluster} />}
        </Match>
        <Match when={route().screen === "resources" && route() as any}>
          {(r) => (
            <ResourcesScreen
              cluster={r().cluster}
              namespace={r().namespace}
              resourceType={r().resourceType}
            />
          )}
        </Match>
        <Match when={route().screen === "detail" && route() as any}>
          {(r) => (
            <DetailScreen
              cluster={r().cluster}
              namespace={r().namespace}
              resourceType={r().resourceType}
              resourceName={r().resourceName}
            />
          )}
        </Match>
      </Switch>

      <box height={1} flexDirection="row" alignItems="center" padding={1} gap={2}>
        <text content={statusText()} fg={statusColor()} />
        <text content={helpText()} fg="#64748b" />
      </box>
    </box>
  )
}
