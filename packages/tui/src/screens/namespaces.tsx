import { createSignal, Show, For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { navigateTo, goBack } from "../app"
import { useNamespaceData } from "../hooks/useNamespaceData"
import { useFilterMode } from "../hooks/useFilterMode"
import { useAddMode } from "../hooks/useAddMode"

export function NamespacesScreen(props: { cluster: string }) {
  const dims = useTerminalDimensions()
  const ns = useNamespaceData(() => props.cluster)
  const filter = useFilterMode(ns.namespaces)
  const add = useAddMode(() => props.cluster, (name) => {
    ns.showStatus(`Added ${name}`)
    ns.refetch()
  })

  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const listW = () => Math.min(56, dims().width - 8)
  const startX = () => Math.floor((dims().width - listW()) / 2)

  useKeyboard((key) => {
    if (add.handleAddKey(key)) return
    if (filter.handleFilterKey(key)) { setSelectedIndex(0); return }

    if (key.name === "j" || key.name === "down") setSelectedIndex(i => Math.min(i + 1, filter.filtered().length - 1))
    if (key.name === "k" || key.name === "up") setSelectedIndex(i => Math.max(i - 1, 0))
    if (key.name === "return") {
      const selected = filter.filtered()[selectedIndex()]
      if (selected) navigateTo({ screen: "resources", cluster: props.cluster, namespace: selected })
    }
    if (key.name === "escape" || key.name === "backspace") goBack()
    if (key.raw === "/") { filter.enterFilter(); setSelectedIndex(0) }
    if (key.raw === "a") add.enterAdd()
    if (key.raw === "r") ns.discoverNamespaces()
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <box height={Math.floor(dims().height * 0.12)} />
      <box flexDirection="row">
        <box width={startX()} />
        <box flexDirection="column" width={listW()}>
          <box flexDirection="row" height={1}>
            <text content={props.cluster} fg="#3b82f6" />
            <text content=" ❯ " fg="#2d3555" />
            <text content="Select namespace" fg="#94a3b8" />
          </box>

          <box height={1} flexDirection="row" paddingLeft={1}>
            <Show when={filter.filterMode()}>
              <text content={`/ ${filter.filterText()}█`} fg="#3b82f6" />
            </Show>
            <Show when={!filter.filterMode() && filter.filterText()}>
              <text content={`⌕ "${filter.filterText()}" (${filter.filtered().length})`} fg="#3b82f6" />
            </Show>
            <Show when={!filter.filterMode() && !filter.filterText()}>
              <text content="/:filter  a:add  r:discover" fg="#475569" />
            </Show>
          </box>

          <box height={1} />

          <Show when={filter.filtered().length > 0} fallback={
            <box flexGrow={1} alignItems="center" justifyContent="center">
              <text content='No namespaces. Press "a" to add one or "r" to discover.' fg="#64748b" />
            </box>
          }>
            <scrollbox flexGrow={1} scrollY={true}>
              <box flexDirection="column">
                <For each={filter.filtered()}>
                  {(item, i) => {
                    const isSel = () => i() === selectedIndex()
                    return (
                      <box height={1} paddingLeft={2} paddingRight={2} backgroundColor={isSel() ? "#1e3a5f" : "#0f0f23"} flexDirection="row">
                        <text content={isSel() ? "▸ " : "  "} fg="#3b82f6" />
                        <text content={item} fg={isSel() ? "#f8fafc" : "#e2e8f0"} />
                      </box>
                    )
                  }}
                </For>
              </box>
            </scrollbox>
          </Show>

          <Show when={add.addMode()}>
            <box height={1} flexDirection="row" paddingLeft={1}>
              <text content={`Add namespace: ${add.addValue()}█`} fg="#e2e8f0" />
            </box>
            <Show when={add.addError()}>
              <box height={1} paddingLeft={1}>
                <text content={add.addError()} fg="#ef4444" />
              </box>
            </Show>
          </Show>

          <Show when={ns.statusMessage()}>
            <box height={1} paddingLeft={1}>
              <text content={ns.statusMessage()} fg="#22c55e" />
            </box>
          </Show>
        </box>
      </box>
    </box>
  )
}
