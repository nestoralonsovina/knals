import { createSignal, Show, For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { navigateTo } from "../app"

export function ClustersScreen(props: { clusters?: { name: string; server: string; user: string; connected: boolean }[] }) {
  const dims = useTerminalDimensions()
  const listW = () => Math.min(64, dims().width - 8)
  const startX = () => Math.floor((dims().width - listW()) / 2)

  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const clusterList = () => props.clusters ?? []

  useKeyboard((key) => {
    if (key.name === "j" || key.name === "down") setSelectedIndex(i => Math.min(i + 1, clusterList().length - 1))
    if (key.name === "k" || key.name === "up") setSelectedIndex(i => Math.max(i - 1, 0))
    if (key.name === "return") {
      const cluster = clusterList()[selectedIndex()]
      if (cluster) navigateTo({ screen: "namespaces", cluster: cluster.name })
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <box height={Math.floor(dims().height * 0.2)} />
      <box flexDirection="row">
        <box width={startX()} />
        <box flexDirection="column" width={listW()}>
          <text content="Select cluster" fg="#94a3b8" height={1} />
          <box height={1} />
          <Show
            when={clusterList().length > 0}
            fallback={
              <text content="Loading clusters..." fg="#64748b" height={1} />
            }
          >
            <For each={clusterList()}>
              {(cluster, i) => {
                const isSel = () => i() === selectedIndex()
                return (
                  <box
                    flexDirection="column"
                    paddingLeft={2}
                    paddingRight={1}
                    height={2}
                    backgroundColor={isSel() ? "#1e3a5f" : "#0f0f23"}
                  >
                    <box flexDirection="row" height={1}>
                      <text content={cluster.connected ? "● " : "  "} fg="#22c55e" />
                      <text content={cluster.name} fg={isSel() ? "#f8fafc" : "#e2e8f0"} />
                    </box>
                    <text content={`  ${cluster.server}  (${cluster.user})`} fg="#475569" height={1} />
                  </box>
                )
              }}
            </For>
          </Show>
        </box>
      </box>
    </box>
  )
}
