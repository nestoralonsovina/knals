import { createSignal, createMemo, createEffect, onCleanup, Show, For, type Accessor } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useResourceData } from "../hooks/useResourceData"
import { usePaneNavigation } from "../hooks/usePaneNavigation"
import { useDetailView } from "../hooks/useDetailView"
import { useKeyboardDispatch } from "../hooks/useKeyboardDispatch"
import { useCapabilities } from "../hooks/useCapabilities"
import { useLogStream } from "../hooks/useLogStream"
import { shortName, hashSuffix, truncate, listBadge, computeDetailWidth, computeListWidth } from "../lib/resource-layout"
import { setCommandContext, onAction } from "../lib/command-context"
import type { Command } from "../lib/commands"

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
  hashFg: "#475569",
  sel: "#1e3a5f",
}

export function ResourcesScreen(props: { cluster: string; namespace: string; initialType?: string; registry: Accessor<Command[]> }) {
  const dims = useTerminalDimensions()
  const rd = useResourceData(() => props.cluster, () => props.namespace)
  const caps = useCapabilities(() => props.cluster, () => props.namespace)
  const logs = useLogStream()
  const nav = usePaneNavigation()
  const detail = useDetailView()

  const selected = () => rd.items()[nav.rowIdx()]
  const showList = () => !detail.logsExpanded()
  const [logScroll, setLogScroll] = createSignal(0)

  const detailW = createMemo(() =>
    detail.detailOpen() ? computeDetailWidth(dims().width, nav.sidebarW()) : 0
  )
  const listAvailW = createMemo(() =>
    computeListWidth(dims().width, nav.sidebarW(), detailW(), detail.detailOpen())
  )

  createEffect(() => {
    const _ = rd.activeType()
    nav.resetRow()
    detail.resetOnTypeChange()
  })

  createEffect(() => {
    if (props.initialType && rd.resourceTypes().length > 0) {
      const idx = rd.resourceTypes().indexOf(props.initialType!)
      if (idx >= 0) rd.selectType(idx)
    }
  })

  createEffect(() => {
    setCommandContext({
      screen: "resources",
      cluster: props.cluster,
      namespace: props.namespace,
      resourceType: rd.activeType(),
      selectedItem: selected(),
      canList: caps.canList,
    })
  })

  const cleanups = [
    onAction("view-yaml", () => {
      const item = selected()
      if (item) {
        if (detail.detailOpen()) {
          detail.toggleYaml()
          if (detail.detailView() === "yaml") rd.fetchDetail(item.name)
        } else {
          detail.openDetail()
          detail.toggleYaml()
          nav.focusDetail()
          rd.fetchDetail(item.name)
        }
      }
    }),
    onAction("refresh", () => {
      rd.selectType(rd.typeIdx())
    }),
    onAction("refresh-capabilities", () => {
      caps.refresh()
    }),
    onAction("view-logs", () => {
      const item = selected()
      if (item && rd.activeType() === "pods") {
        detail.openDetail()
        nav.focusDetail()
        detail.toggleLogs()
        logs.start(props.cluster, props.namespace, item.name)
      }
    }),
  ]

  function handleSelectType(type: string) {
    const idx = rd.resourceTypes().indexOf(type)
    if (idx >= 0) {
      rd.selectType(idx)
      nav.resetRow()
      detail.resetOnTypeChange()
      nav.focusList()
    }
  }

  createEffect(() => {
    for (const type of rd.resourceTypes()) {
      cleanups.push(onAction(`select-type:${type}`, () => handleSelectType(type)))
    }
  })

  createEffect(() => {
    if (detail.detailView() === "logs" && detail.detailOpen() && rd.activeType() === "pods") {
      const item = selected()
      if (item) logs.start(props.cluster, props.namespace, item.name)
    } else {
      logs.stop()
    }
  })

  createEffect(() => {
    const lineCount = logs.lines().length
    if (logs.isFollowing() && lineCount > 0) {
      setLogScroll(Math.max(0, lineCount - (dims().height - 6)))
    }
  })

  onCleanup(() => { logs.stop(); cleanups.forEach(fn => fn()) })

  useKeyboardDispatch({
    cluster: props.cluster,
    pane: nav.pane,
    nav, detail, rd, selected,
    registry: props.registry,
    logs: {
      scrollUp: logs.scrollUp,
      toggleFollow: logs.toggleFollow,
      isFollowing: logs.isFollowing,
      setLogScroll,
      logScroll,
      lineCount: () => logs.lines().length,
    },
  })

  const describeContent = () => {
    const text = rd.describeText()
    if (!text) return "Loading..."
    return text.split("\n").slice(rd.detailScroll()).join("\n")
  }

  const yamlContent = () => {
    const json = rd.detailJson()
    if (!json) return "Loading..."
    return json.split("\n").slice(rd.detailScroll()).join("\n")
  }

  const headerText = createMemo(() => {
    const base = `${props.cluster} ❯ ${props.namespace} ❯ ${rd.activeType()}`
    if (!detail.detailOpen() || !selected()) return base
    return truncate(`${base} ❯ ${shortName(selected()!.name)}`, dims().width - 18)
  })

  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={C.bg}>
      <box height={1} flexDirection="row" paddingLeft={1} backgroundColor={C.sidebar}>
        <text content={headerText()} fg={C.accent} />
        <box flexGrow={1} />
        <text content="C:cluster N:ns ::cmd " fg={C.dim} />
      </box>

      <box flexDirection="row" flexGrow={1}>
        <box width={nav.sidebarW()} flexDirection="column" border={true} borderStyle="rounded" borderColor={nav.pane() === "sidebar" ? C.activeBorder : C.border} backgroundColor={C.sidebar}>
          <scrollbox flexGrow={1} scrollY={true}>
            <box flexDirection="column">
              <For each={rd.resourceTypes()}>
                {(rt, i) => {
                  const isActive = () => i() === rd.typeIdx()
                  const isSel = () => i() === nav.sidebarCursor() && nav.pane() === "sidebar"
                  const count = () => isActive() ? ` ${rd.items().length}` : ""
                  const accessible = () => caps.canList(rt)
                  const fg = () => {
                    if (!accessible()) return C.dim
                    if (isSel()) return C.bright
                    if (isActive()) return C.accent
                    return C.text
                  }
                  return (
                    <box height={1} paddingLeft={1} backgroundColor={isSel() ? C.sel : C.sidebar}>
                      <text content={`${isActive() ? "▸" : " "} ${rt}${count()}`} fg={fg()} />
                    </box>
                  )
                }}
              </For>
            </box>
          </scrollbox>
        </box>

        <Show when={showList()}>
          <box flexDirection="column" flexGrow={detail.detailOpen() ? 0 : 1} width={detail.detailOpen() ? dims().width - nav.sidebarW() - detailW() : undefined} border={true} borderStyle="rounded" borderColor={nav.pane() === "list" ? C.activeBorder : C.border} backgroundColor={C.bg}>
            <Show when={rd.items().length > 0} fallback={
              <box flexGrow={1} alignItems="center" justifyContent="center">
                <text content={rd.error() || `No ${rd.activeType()} found`} fg={rd.error() ? "#ef4444" : C.muted} />
              </box>
            }>
              <scrollbox flexGrow={1} scrollY={true}>
                <box flexDirection="column">
                  <For each={rd.items()}>
                    {(item, i) => {
                      const isSel = () => i() === nav.rowIdx()
                      const short = () => shortName(item.name)
                      const hash = () => hashSuffix(item.name)
                      const badge = () => listBadge(item.cells)
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

        <Show when={detail.detailOpen()}>
          <box flexDirection="column" flexGrow={detail.logsExpanded() ? 1 : 0} width={detail.logsExpanded() ? undefined : detailW()} border={true} borderStyle="rounded" borderColor={nav.pane() === "detail" ? C.activeBorder : C.border} backgroundColor={detail.detailView() === "logs" ? C.logBg : C.detailBg}>
            <Show when={detail.detailView() === "describe"}>
              <box flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={C.sidebar} flexDirection="row">
                <text content={truncate(`${rd.activeType()}/${selected()?.name ?? ""}`, detailW() - 14)} fg={C.bright} height={1} />
                <box flexGrow={1} />
                <text content=" Y:yaml " fg={C.dim} />
              </box>
              <box flexGrow={1} paddingLeft={1}>
                <text content={describeContent()} fg={C.text} />
              </box>
            </Show>
            <Show when={detail.detailView() === "yaml"}>
              <box flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={C.sidebar} flexDirection="row">
                <text content={truncate(`${rd.activeType()}/${selected()?.name ?? ""} [YAML]`, detailW() - 14)} fg={C.bright} height={1} />
                <box flexGrow={1} />
                <text content=" Y:describe " fg={C.dim} />
              </box>
              <box flexGrow={1} paddingLeft={1}>
                <text content={yamlContent()} fg={C.text} />
              </box>
            </Show>
            <Show when={detail.detailView() === "logs"}>
              <box height={1} paddingLeft={1} backgroundColor={C.sidebar} flexDirection="row">
                <text content={truncate(selected()?.name ?? "?", (detail.logsExpanded() ? dims().width - nav.sidebarW() : detailW()) - 30)} fg={C.accent} />
                <text content={logs.isConnected() ? (logs.isFollowing() ? " FOLLOW" : " PAUSED") : ""} fg={logs.isFollowing() ? "#22c55e" : "#eab308"} />
                <box flexGrow={1} />
                <text content={detail.logsExpanded() ? " F:collapse " : " F:expand "} fg={C.dim} />
              </box>
              <Show when={logs.lines().length > 0}>
                <box flexGrow={1} paddingLeft={1}>
                  <text content={logs.lines().slice(logScroll()).join("\n")} fg={C.text} />
                </box>
              </Show>
              <Show when={logs.lines().length === 0}>
                <box flexGrow={1} alignItems="center" justifyContent="center">
                  <text content={logs.isConnected() ? "Waiting for log output..." : "Connecting..."} fg={C.dim} />
                </box>
              </Show>
            </Show>
          </box>
        </Show>
      </box>

      <box height={1} flexDirection="row" paddingLeft={1} backgroundColor={C.sidebar}>
        <text content={`[${nav.pane().toUpperCase()}${detail.detailView() === "logs" && detail.detailOpen() ? "/LOGS" : ""}]`} fg={C.accent} />
        <text content={`  ${rd.items().length > 0 ? `${nav.rowIdx() + 1}/${rd.items().length}` : "empty"}`} fg={C.muted} />
        <Show when={!detail.detailOpen()}>
          <text content="  j/k:nav  Enter:detail  Tab:pane  ::cmd" fg={C.dim} />
        </Show>
        <Show when={detail.detailOpen() && !detail.logsExpanded()}>
          <text content="  Y:yaml  L:logs  h/l:pane  Esc:back" fg={C.dim} />
        </Show>
        <Show when={detail.logsExpanded()}>
          <text content={`  F:collapse${!logs.isFollowing() ? "  S:follow" : ""}  Esc:back`} fg={C.dim} />
        </Show>
      </box>
    </box>
  )
}
