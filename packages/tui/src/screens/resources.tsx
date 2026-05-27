import { createSignal, createEffect, createMemo, onCleanup, Show, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { RESOURCE_TYPES, type ResourceType } from "../state"
import {
  getClustersByCtxNamespaces,
  getClustersByCtxNamespacesByNsResourcesByType,
  getClustersByCtxNamespacesByNsResourcesByTypeByName,
} from "@knals/sdk"
import { goBack } from "../app"

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
  section: "#94a3b8",
  labelFg: "#7c8fa8",
}

export function ResourcesScreen(props: { cluster: string; namespace: string; resourceType: ResourceType }) {
  const [pane, setPane] = createSignal<Pane>("list")
  const [typeIdx, setTypeIdx] = createSignal(RESOURCE_TYPES.indexOf(props.resourceType))
  const [rowIdx, setRowIdx] = createSignal(0)
  const [detailOpen, setDetailOpen] = createSignal(false)
  const [detailJson, setDetailJson] = createSignal("")
  const [detailScroll, setDetailScroll] = createSignal(0)
  const [data, setData] = createSignal<ResourceData | null>(null)
  const [namespaces, setNamespaces] = createSignal<string[]>([])
  const [sidebarCursor, setSidebarCursor] = createSignal(0)
  const [error, setError] = createSignal("")

  const activeType = () => RESOURCE_TYPES[typeIdx()]
  const items = () => data()?.items ?? []
  const selected = () => items()[rowIdx()]

  async function fetchNamespaces() {
    try {
      const result = await getClustersByCtxNamespaces({ path: { ctx: props.cluster } })
      setNamespaces((result.data as string[] | undefined) ?? [])
    } catch {}
  }

  async function fetchResources() {
    try {
      const result = await getClustersByCtxNamespacesByNsResourcesByType({
        path: { ctx: props.cluster, ns: props.namespace, type: activeType() },
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

  fetchNamespaces()

  createEffect(() => {
    const _ = activeType()
    setData(null)
    setRowIdx(0)
    setDetailOpen(false)
    fetchResources()
  })

  const pollInterval = setInterval(fetchResources, 2000)
  onCleanup(() => clearInterval(pollInterval))

  const sidebarEntries = createMemo(() => {
    const entries: { kind: "ns" | "rt"; idx: number; label: string; active: boolean }[] = []
    for (const ns of namespaces()) {
      entries.push({ kind: "ns", idx: entries.length, label: ns, active: ns === props.namespace })
    }
    for (let i = 0; i < RESOURCE_TYPES.length; i++) {
      const rt = RESOURCE_TYPES[i]
      const count = rt === activeType() ? items().length : 0
      entries.push({
        kind: "rt", idx: entries.length,
        label: `${rt}${rt === activeType() ? ` ${count}` : ""}`,
        active: i === typeIdx(),
      })
    }
    return entries
  })

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "backspace") {
      if (detailOpen()) { setDetailOpen(false); setPane("list"); return }
      if (pane() !== "list") { setPane("list"); return }
      goBack()
      return
    }

    if (key.name === "tab") {
      if (detailOpen()) {
        const panes: Pane[] = ["sidebar", "list", "detail"]
        setPane(panes[(panes.indexOf(pane()) + 1) % panes.length])
      } else {
        setPane(pane() === "sidebar" ? "list" : "sidebar")
      }
      return
    }

    if (pane() === "sidebar") {
      if (key.name === "j" || key.name === "down") setSidebarCursor(i => Math.min(i + 1, sidebarEntries().length - 1))
      if (key.name === "k" || key.name === "up") setSidebarCursor(i => Math.max(i - 1, 0))
      if (key.name === "return" || key.name === "l" || key.name === "right") {
        const entry = sidebarEntries()[sidebarCursor()]
        if (entry?.kind === "rt") {
          const rtIdx = sidebarEntries().filter(e => e.kind === "ns").length
          setTypeIdx(sidebarCursor() - rtIdx)
          setRowIdx(0)
          setDetailOpen(false)
        }
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
          setPane("detail")
          fetchDetail(item.name)
        }
      }
    }

    if (pane() === "detail") {
      if (key.name === "h" || key.name === "left") setPane("list")
      if (key.name === "j" || key.name === "down") setDetailScroll(s => s + 1)
      if (key.name === "k" || key.name === "up") setDetailScroll(s => Math.max(0, s - 1))
      if (key.name === "g") setDetailScroll(0)
    }
  })

  const detailContent = () => {
    const json = detailJson()
    if (!json) return "Loading..."
    const lines = json.split("\n")
    return lines.slice(detailScroll()).join("\n")
  }

  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={C.bg}>
      <box flexDirection="row" flexGrow={1}>
        {/* Sidebar */}
        <box
          width={22}
          flexDirection="column"
          border={true}
          borderStyle="rounded"
          borderColor={pane() === "sidebar" ? C.activeBorder : C.border}
          backgroundColor={C.sidebar}
        >
          <text content=" NS" fg={C.section} height={1} />
          <For each={sidebarEntries().filter(e => e.kind === "ns")}>
            {(entry) => {
              const sIdx = () => sidebarEntries().indexOf(entry)
              const isSel = () => sIdx() === sidebarCursor() && pane() === "sidebar"
              return (
                <box height={1} paddingLeft={1} backgroundColor={isSel() ? "#1e3a5f" : C.sidebar}>
                  <text
                    content={`${entry.active ? "●" : " "} ${entry.label}`}
                    fg={isSel() ? C.bright : entry.active ? C.accent : C.text}
                  />
                </box>
              )
            }}
          </For>
          <box height={1}><text content=" ─────────" fg={C.border} /></box>
          <text content=" RES" fg={C.section} height={1} />
          <For each={sidebarEntries().filter(e => e.kind === "rt")}>
            {(entry) => {
              const sIdx = () => sidebarEntries().indexOf(entry)
              const isSel = () => sIdx() === sidebarCursor() && pane() === "sidebar"
              return (
                <box height={1} paddingLeft={1} backgroundColor={isSel() ? "#1e3a5f" : C.sidebar}>
                  <text
                    content={`${entry.active ? "▸" : " "} ${entry.label}`}
                    fg={isSel() ? C.bright : entry.active ? C.accent : C.text}
                  />
                </box>
              )
            }}
          </For>
          <box flexGrow={1} />
        </box>

        {/* Resource list */}
        <box
          flexDirection="column"
          flexGrow={detailOpen() ? 0 : 1}
          width={detailOpen() ? 40 : undefined}
          border={true}
          borderStyle="rounded"
          borderColor={pane() === "list" ? C.activeBorder : C.border}
          backgroundColor={C.bg}
        >
          <Show
            when={items().length > 0}
            fallback={
              <box flexGrow={1} alignItems="center" justifyContent="center">
                <text content={error() || `No ${activeType()} found`} fg={error() ? "#ef4444" : C.muted} />
              </box>
            }
          >
            <For each={items()}>
              {(item, i) => {
                const isSel = () => i() === rowIdx()
                const badge = () => item.cells.length > 2 ? item.cells[2] : ""
                return (
                  <box height={1} paddingLeft={1} backgroundColor={isSel() ? "#1e3a5f" : C.bg} flexDirection="row">
                    <text content={`${isSel() ? "▸" : " "} ${item.name}`} fg={isSel() ? C.bright : C.text} />
                    <box flexGrow={1} />
                    <text content={` ${badge()} `} fg={C.muted} />
                  </box>
                )
              }}
            </For>
          </Show>
        </box>

        {/* Detail panel */}
        <Show when={detailOpen()}>
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="rounded"
            borderColor={pane() === "detail" ? C.activeBorder : C.border}
            backgroundColor={C.detailBg}
          >
            <box height={1} paddingLeft={1}>
              <text content={`${activeType()}/${selected()?.name ?? ""}`} fg={C.accent} />
            </box>
            <box flexGrow={1} paddingLeft={1}>
              <text content={detailContent()} fg={C.text} />
            </box>
          </box>
        </Show>
      </box>

      {/* Status bar */}
      <box height={1} flexDirection="row" paddingLeft={1} backgroundColor={C.sidebar}>
        <text content={`[${pane().toUpperCase()}]`} fg={C.accent} />
        <text content={`  ${rowIdx() + 1}/${items().length}`} fg={C.muted} />
        <Show when={!detailOpen()}>
          <text content="  j/k:nav  Enter:detail  h:sidebar  Tab:cycle" fg={C.dim} />
        </Show>
        <Show when={detailOpen()}>
          <text content="  h/l:pane  j/k:scroll  Esc:close  Tab:cycle" fg={C.dim} />
        </Show>
      </box>
    </box>
  )
}
