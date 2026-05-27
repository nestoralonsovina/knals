import { createSignal, createEffect, createMemo, onCleanup, Show, For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import {
  getResourcesTypes,
  getClustersByCtxNamespacesByNsResourcesByType,
  getClustersByCtxNamespacesByNsResourcesByTypeByName,
} from "@knals/sdk"
import { navigateTo } from "../app"

interface ResourceItem {
  name: string
  namespace: string
  cells: string[]
  creationTimestamp: string
}

interface ResourceData {
  kind: string
  columns: string[]
  items: ResourceItem[]
}

type DetailView = "info" | "logs"
type Pane = "sidebar" | "list" | "detail"

const C = {
  bg: "#0f0f23",
  sidebar: "#111827",
  border: "#2d3555",
  activeBorder: "#3b82f6",
  accent: "#3b82f6",
  text: "#e2e8f0",
  muted: "#64748b",
  bright: "#f8fafc",
  dim: "#475569",
  detailBg: "#0d1117",
  logBg: "#0a0a1a",
  section: "#94a3b8",
  labelFg: "#7c8fa8",
  hashFg: "#475569",
  sel: "#1e3a5f",
}

function shortName(fullName: string): string {
  const m = fullName.match(/^(.+?)-[a-f0-9]{7,10}-[a-z0-9]{5}$/)
  if (m) return m[1]
  const m2 = fullName.match(/^(.+?)-[a-f0-9]{7,10}$/)
  if (m2) return m2[1]
  return fullName
}

function hashSuffix(fullName: string): string {
  const s = shortName(fullName)
  return s === fullName ? "" : fullName.slice(s.length)
}

function truncate(s: string, max: number): string {
  if (max < 1) return ""
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}

export function ResourcesScreen(props: { cluster: string; namespace: string }) {
  const dims = useTerminalDimensions()

  const [resourceTypes, setResourceTypes] = createSignal<string[]>([])
  const [pane, setPane] = createSignal<Pane>("list")
  const [typeIdx, setTypeIdx] = createSignal(0)
  const [rowIdx, setRowIdx] = createSignal(0)
  const [sidebarW, setSidebarW] = createSignal(20)
  const [detailOpen, setDetailOpen] = createSignal(false)
  const [detailView, setDetailView] = createSignal<DetailView>("info")
  const [logsExpanded, setLogsExpanded] = createSignal(false)
  const [detailJson, setDetailJson] = createSignal("")
  const [detailScroll, setDetailScroll] = createSignal(0)
  const [data, setData] = createSignal<ResourceData | null>(null)
  const [sidebarCursor, setSidebarCursor] = createSignal(0)
  const [error, setError] = createSignal("")

  const activeType = () => resourceTypes()[typeIdx()]
  const items = () => data()?.items ?? []
  const columns = () => data()?.columns ?? []
  const selected = () => items()[rowIdx()]

  const showList = () => !logsExpanded()
  const detailW = createMemo(() => {
    if (!detailOpen()) return 0
    return Math.max(36, Math.floor((dims().width - sidebarW()) * 0.48))
  })
  const listAvailW = createMemo(() => {
    if (!detailOpen()) return dims().width - sidebarW() - 4
    return dims().width - sidebarW() - detailW() - 4
  })

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

  async function fetchResources() {
    const type = activeType()
    if (!type) return
    try {
      const result = await getClustersByCtxNamespacesByNsResourcesByType({
        path: { ctx: props.cluster, ns: props.namespace, type },
      })
      if (result.data) {
        setData(result.data as unknown as ResourceData)
        setError("")
      }
    } catch {
      setError("Failed to fetch resources")
    }
  }

  async function fetchDetail(name: string) {
    try {
      const result = await getClustersByCtxNamespacesByNsResourcesByTypeByName({
        path: { ctx: props.cluster, ns: props.namespace, type: activeType(), name },
      })
      if (result.data) {
        setDetailJson(JSON.stringify(result.data, null, 2))
      } else {
        setDetailJson("Resource not found")
      }
    } catch {
      setDetailJson("Failed to load resource")
    }
    setDetailScroll(0)
  }

  createEffect(() => {
    const _ = activeType()
    setData(null)
    setRowIdx(0)
    setDetailOpen(false)
    setLogsExpanded(false)
    fetchResources()
  })

  const pollInterval = setInterval(fetchResources, 2000)
  onCleanup(() => clearInterval(pollInterval))

  useKeyboard((key) => {
    if (key.name === "escape") {
      if (logsExpanded()) { setLogsExpanded(false); return }
      if (detailView() === "logs") { setDetailView("info"); return }
      if (detailOpen()) { setDetailOpen(false); setPane("list"); return }
      if (pane() === "sidebar") { setPane("list"); return }
      return
    }

    if (key.name === "tab") {
      if (detailOpen() && !logsExpanded()) {
        const panes: Pane[] = ["sidebar", "list", "detail"]
        setPane(panes[(panes.indexOf(pane()) + 1) % panes.length])
      } else {
        setPane(pane() === "sidebar" ? "list" : "sidebar")
      }
      return
    }

    if (key.raw === "C") { navigateTo({ screen: "clusters" }); return }
    if (key.raw === "N") { navigateTo({ screen: "namespaces", cluster: props.cluster }); return }
    if (key.raw === "[") { setSidebarW(w => Math.max(14, w - 2)); return }
    if (key.raw === "]") { setSidebarW(w => Math.min(34, w + 2)); return }

    if (pane() === "sidebar") {
      if (key.name === "j" || key.name === "down") setSidebarCursor(i => Math.min(i + 1, resourceTypes().length - 1))
      if (key.name === "k" || key.name === "up") setSidebarCursor(i => Math.max(i - 1, 0))
      if (key.name === "return" || key.name === "l" || key.name === "right") {
        setTypeIdx(sidebarCursor())
        setRowIdx(0)
        setDetailOpen(false)
        setLogsExpanded(false)
        setPane("list")
      }
    }

    if (pane() === "list") {
      if (key.name === "j" || key.name === "down") setRowIdx(i => Math.min(i + 1, items().length - 1))
      if (key.name === "k" || key.name === "up") setRowIdx(i => Math.max(i - 1, 0))
      if (key.name === "h" || key.name === "left") setPane("sidebar")
      if (key.name === "l" || key.name === "right") { if (detailOpen()) setPane("detail") }
      if (key.name === "return") {
        const item = selected()
        if (item) {
          setDetailOpen(true)
          setDetailView("info")
          setLogsExpanded(false)
          setPane("detail")
          fetchDetail(item.name)
        }
      }
      if (key.name === "g") setRowIdx(0)
      if (key.raw === "G") setRowIdx(Math.max(0, items().length - 1))
    }

    if (pane() === "detail") {
      if (key.name === "h" || key.name === "left") { if (!logsExpanded()) setPane("list") }
      if (key.raw === "L" || key.raw === "l") { setDetailView(v => v === "logs" ? "info" : "logs"); setLogsExpanded(false) }
      if (key.raw === "F") {
        if (detailView() !== "logs") setDetailView("logs")
        setLogsExpanded(v => !v)
      }
      if (detailView() === "info") {
        if (key.name === "j" || key.name === "down") setDetailScroll(s => s + 1)
        if (key.name === "k" || key.name === "up") setDetailScroll(s => Math.max(0, s - 1))
        if (key.name === "g") setDetailScroll(0)
      }
    }
  })

  const detailContent = () => {
    const json = detailJson()
    if (!json) return "Loading..."
    const lines = json.split("\n")
    return lines.slice(detailScroll()).join("\n")
  }

  function listBadge(item: ResourceItem): string {
    return item.cells.length > 2 ? item.cells[2] : ""
  }

  const headerText = createMemo(() => {
    const base = `${props.cluster} ❯ ${props.namespace} ❯ ${activeType()}`
    if (!detailOpen() || !selected()) return base
    const sn = shortName(selected()!.name)
    const maxW = dims().width - 18
    return truncate(`${base} ❯ ${sn}`, maxW)
  })

  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={C.bg}>
      {/* Header */}
      <box height={1} flexDirection="row" paddingLeft={1} backgroundColor={C.sidebar}>
        <text content={headerText()} fg={C.accent} />
        <box flexGrow={1} />
        <text content="C:cluster N:ns " fg={C.dim} />
      </box>

      <box flexDirection="row" flexGrow={1}>
        {/* Sidebar — resource types only */}
        <box width={sidebarW()} flexDirection="column" border={true} borderStyle="rounded" borderColor={pane() === "sidebar" ? C.activeBorder : C.border} backgroundColor={C.sidebar}>
          <scrollbox flexGrow={1} scrollY={true}>
            <box flexDirection="column">
              <For each={resourceTypes()}>
                {(rt, i) => {
                  const isActive = () => i() === typeIdx()
                  const isSel = () => i() === sidebarCursor() && pane() === "sidebar"
                  const count = () => isActive() ? ` ${items().length}` : ""
                  return (
                    <box height={1} paddingLeft={1} backgroundColor={isSel() ? C.sel : C.sidebar}>
                      <text
                        content={`${isActive() ? "▸" : " "} ${rt}${count()}`}
                        fg={isSel() ? C.bright : isActive() ? C.accent : C.text}
                      />
                    </box>
                  )
                }}
              </For>
            </box>
          </scrollbox>
        </box>

        {/* Resource list */}
        <Show when={showList()}>
          <box flexDirection="column" flexGrow={detailOpen() ? 0 : 1} width={detailOpen() ? dims().width - sidebarW() - detailW() : undefined} border={true} borderStyle="rounded" borderColor={pane() === "list" ? C.activeBorder : C.border} backgroundColor={C.bg}>
            <Show
              when={items().length > 0}
              fallback={
                <box flexGrow={1} alignItems="center" justifyContent="center">
                  <text content={error() || `No ${activeType()} found`} fg={error() ? "#ef4444" : C.muted} />
                </box>
              }
            >
              <scrollbox flexGrow={1} scrollY={true}>
                <box flexDirection="column">
                  <For each={items()}>
                    {(item, i) => {
                      const isSel = () => i() === rowIdx()
                      const short = () => shortName(item.name)
                      const hash = () => hashSuffix(item.name)
                      const badge = () => listBadge(item)
                      const nameMaxW = () => Math.max(8, listAvailW() - badge().length - 4)
                      return (
                        <box height={1} paddingLeft={1} backgroundColor={isSel() ? C.sel : C.bg} flexDirection="row">
                          <text content={`${isSel() ? "▸" : " "} `} fg={isSel() ? C.bright : C.text} />
                          <text content={truncate(short(), nameMaxW())} fg={isSel() ? C.bright : C.text} />
                          <Show when={hash() && nameMaxW() > short().length + 3}>
                            <text content={truncate(hash(), nameMaxW() - short().length)} fg={C.hashFg} />
                          </Show>
                          <box flexGrow={1} />
                          <Show when={badge()}>
                            <text content={` ${badge()} `} fg={C.muted} />
                          </Show>
                        </box>
                      )
                    }}
                  </For>
                </box>
              </scrollbox>
            </Show>
          </box>
        </Show>

        {/* Detail panel */}
        <Show when={detailOpen()}>
          <box flexDirection="column" flexGrow={logsExpanded() ? 1 : 0} width={logsExpanded() ? undefined : detailW()} border={true} borderStyle="rounded" borderColor={pane() === "detail" ? C.activeBorder : C.border} backgroundColor={detailView() === "logs" ? C.logBg : C.detailBg}>
            <Show when={detailView() === "info"}>
              <box flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={C.sidebar}>
                <text content={truncate(`${activeType()}/${selected()?.name ?? ""}`, detailW() - 4)} fg={C.bright} height={1} />
              </box>
              <box flexGrow={1} paddingLeft={1}>
                <text content={detailContent()} fg={C.text} />
              </box>
            </Show>
            <Show when={detailView() === "logs"}>
              <box height={1} paddingLeft={1} backgroundColor={C.sidebar}>
                <text content={truncate(selected()?.name ?? "?", (logsExpanded() ? dims().width - sidebarW() : detailW()) - 16)} fg={C.accent} />
                <box flexGrow={1} />
                <text content={logsExpanded() ? " F:collapse " : " F:expand "} fg={C.dim} />
              </box>
              <box flexGrow={1} alignItems="center" justifyContent="center">
                <text content="Log streaming not yet connected" fg={C.dim} />
              </box>
            </Show>
          </box>
        </Show>
      </box>

      {/* Status bar */}
      <box height={1} flexDirection="row" paddingLeft={1} backgroundColor={C.sidebar}>
        <text content={`[${pane().toUpperCase()}${detailView() === "logs" && detailOpen() ? "/LOGS" : ""}]`} fg={C.accent} />
        <text content={`  ${items().length > 0 ? `${rowIdx() + 1}/${items().length}` : "empty"}`} fg={C.muted} />
        <Show when={!detailOpen()}>
          <text content="  j/k:nav  Enter:detail  Tab:pane" fg={C.dim} />
        </Show>
        <Show when={detailOpen() && !logsExpanded()}>
          <text content="  L:logs  F:expand  h/l:pane  Esc:back" fg={C.dim} />
        </Show>
        <Show when={logsExpanded()}>
          <text content="  F:collapse  Esc:back" fg={C.dim} />
        </Show>
      </box>
    </box>
  )
}
