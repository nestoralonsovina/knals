import { createSignal, createResource, onMount, Show, For, createMemo } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import {
  getClustersByCtxNamespaces,
  postClustersByCtxNamespaces,
  postClustersByCtxNamespacesDiscover,
} from "@knals/sdk"
import { navigateTo, goBack } from "../app"

export function NamespacesScreen(props: { cluster: string }) {
  const dims = useTerminalDimensions()
  const [namespaces, { refetch }] = createResource(
    () => props.cluster,
    async (ctx) => {
      const result = await getClustersByCtxNamespaces({ path: { ctx } })
      return result.data ?? []
    }
  )

  onMount(() => { discoverNamespaces() })

  async function discoverNamespaces() {
    try {
      const result = await postClustersByCtxNamespacesDiscover({
        path: { ctx: props.cluster },
      })
      const newOnes = (result.data as string[] | undefined) ?? []
      if (newOnes.length > 0) {
        showStatus(`Discovered ${newOnes.length} namespace${newOnes.length > 1 ? "s" : ""}`)
        refetch()
      }
    } catch { /* discovery unavailable */ }
  }

  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [filterMode, setFilterMode] = createSignal(false)
  const [filterText, setFilterText] = createSignal("")
  const [addMode, setAddMode] = createSignal(false)
  const [addValue, setAddValue] = createSignal("")
  const [addError, setAddError] = createSignal("")
  const [statusMessage, setStatusMessage] = createSignal("")

  function showStatus(msg: string) {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(""), 3000)
  }

  const currentNamespaces = () => namespaces() ?? []

  const filtered = createMemo(() => {
    const f = filterText().toLowerCase()
    return f ? currentNamespaces().filter(ns => ns.toLowerCase().includes(f)) : currentNamespaces()
  })

  const listW = () => Math.min(56, dims().width - 8)
  const startX = () => Math.floor((dims().width - listW()) / 2)

  useKeyboard((key) => {
    if (addMode()) {
      if (key.name === "escape") { setAddMode(false); setAddValue(""); setAddError("") }
      else if (key.name === "return") {
        const name = addValue().trim()
        if (name) addNamespace(name)
      }
      else if (key.name === "backspace") { setAddValue(v => v.slice(0, -1)); setAddError("") }
      else if (key.raw && key.raw.length === 1 && !key.ctrl && !key.meta) { setAddValue(v => v + key.raw); setAddError("") }
      return
    }

    if (filterMode()) {
      if (key.name === "escape") { setFilterMode(false) }
      else if (key.name === "return") { setFilterMode(false) }
      else if (key.name === "backspace") { setFilterText(v => v.slice(0, -1)); setSelectedIndex(0) }
      else if (key.raw?.length === 1 && !key.ctrl && !key.meta) { setFilterText(v => v + key.raw); setSelectedIndex(0) }
      return
    }

    if (key.name === "j" || key.name === "down") setSelectedIndex(i => Math.min(i + 1, filtered().length - 1))
    if (key.name === "k" || key.name === "up") setSelectedIndex(i => Math.max(i - 1, 0))
    if (key.name === "return") {
      const ns = filtered()[selectedIndex()]
      if (ns) navigateTo({ screen: "resources", cluster: props.cluster, namespace: ns })
    }
    if (key.name === "escape" || key.name === "backspace") goBack()
    if (key.raw === "/") { setFilterMode(true); setFilterText(""); setSelectedIndex(0) }
    if (key.raw === "a") { setAddMode(true); setAddValue(""); setAddError("") }
    if (key.raw === "r") discoverNamespaces()
  })

  async function addNamespace(name: string) {
    const result = await postClustersByCtxNamespaces({
      path: { ctx: props.cluster },
      body: { name },
    })
    if (result.error) {
      setAddError("Namespace not found or not accessible")
      return
    }
    setAddMode(false)
    setAddValue("")
    setAddError("")
    showStatus(`Added ${name}`)
    refetch()
  }

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

          {/* Filter bar */}
          <box height={1} flexDirection="row" paddingLeft={1}>
            <Show when={filterMode()}>
              <text content={`/ ${filterText()}█`} fg="#3b82f6" />
            </Show>
            <Show when={!filterMode() && filterText()}>
              <text content={`⌕ "${filterText()}" (${filtered().length})`} fg="#3b82f6" />
            </Show>
            <Show when={!filterMode() && !filterText()}>
              <text content="/:filter  a:add  r:discover" fg="#475569" />
            </Show>
          </box>

          <box height={1} />

          <Show
            when={filtered().length > 0}
            fallback={
              <box flexGrow={1} alignItems="center" justifyContent="center">
                <text content='No namespaces. Press "a" to add one or "r" to discover.' fg="#64748b" />
              </box>
            }
          >
            <scrollbox flexGrow={1} scrollY={true}>
              <box flexDirection="column">
                <For each={filtered()}>
                  {(ns, i) => {
                    const isSel = () => i() === selectedIndex()
                    return (
                      <box height={1} paddingLeft={2} paddingRight={2} backgroundColor={isSel() ? "#1e3a5f" : "#0f0f23"} flexDirection="row">
                        <text content={isSel() ? "▸ " : "  "} fg="#3b82f6" />
                        <text content={ns} fg={isSel() ? "#f8fafc" : "#e2e8f0"} />
                      </box>
                    )
                  }}
                </For>
              </box>
            </scrollbox>
          </Show>

          {/* Add namespace input */}
          <Show when={addMode()}>
            <box height={1} flexDirection="row" paddingLeft={1}>
              <text content={`Add namespace: ${addValue()}█`} fg="#e2e8f0" />
            </box>
            <Show when={addError()}>
              <box height={1} paddingLeft={1}>
                <text content={addError()} fg="#ef4444" />
              </box>
            </Show>
          </Show>

          {/* Status message */}
          <Show when={statusMessage()}>
            <box height={1} paddingLeft={1}>
              <text content={statusMessage()} fg="#22c55e" />
            </box>
          </Show>
        </box>
      </box>
    </box>
  )
}
