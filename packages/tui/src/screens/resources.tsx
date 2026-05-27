import { createMemo, createEffect, Show, For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { navigateTo } from "../app"
import { useResourceData } from "../hooks/useResourceData"
import { usePaneNavigation } from "../hooks/usePaneNavigation"
import { useDetailView } from "../hooks/useDetailView"
import { shortName, hashSuffix, truncate, listBadge, computeDetailWidth, computeListWidth } from "../lib/resource-layout"

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
  hashFg: "#475569",
  sel: "#1e3a5f",
}

export function ResourcesScreen(props: { cluster: string; namespace: string }) {
  const dims = useTerminalDimensions()
  const rd = useResourceData(() => props.cluster, () => props.namespace)
  const nav = usePaneNavigation()
  const detail = useDetailView()

  const selected = () => rd.items()[nav.rowIdx()]
  const showList = () => !detail.logsExpanded()

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

  useKeyboard((key) => {
    if (key.name === "escape") {
      if (detail.logsExpanded()) { detail.toggleLogsExpanded(); return }
      if (detail.detailView() === "logs") { detail.toggleLogs(); return }
      if (detail.detailOpen()) { detail.closeDetail(); nav.focusList(); return }
      if (nav.pane() === "sidebar") { nav.focusList(); return }
      navigateTo({ screen: "namespaces", cluster: props.cluster })
      return
    }

    if (key.name === "tab") { nav.cyclePane(detail.detailOpen(), detail.logsExpanded()); return }
    if (key.raw === "C") { navigateTo({ screen: "clusters" }); return }
    if (key.raw === "N") { navigateTo({ screen: "namespaces", cluster: props.cluster }); return }
    if (key.raw === "[") { nav.resizeSidebar(-2); return }
    if (key.raw === "]") { nav.resizeSidebar(2); return }

    if (nav.pane() === "sidebar") {
      if (key.name === "j" || key.name === "down") nav.moveSidebarCursor(1, rd.resourceTypes().length - 1)
      if (key.name === "k" || key.name === "up") nav.moveSidebarCursor(-1, rd.resourceTypes().length - 1)
      if (key.name === "return" || key.name === "l" || key.name === "right") {
        rd.selectType(nav.sidebarCursor())
        nav.resetRow()
        detail.resetOnTypeChange()
        nav.focusList()
      }
    }

    if (nav.pane() === "list") {
      if (key.name === "j" || key.name === "down") nav.moveRow(1, rd.items().length - 1)
      if (key.name === "k" || key.name === "up") nav.moveRow(-1, rd.items().length - 1)
      if (key.name === "h" || key.name === "left") nav.focusSidebar()
      if (key.name === "l" || key.name === "right") { if (detail.detailOpen()) nav.focusDetail() }
      if (key.name === "return") {
        const item = selected()
        if (item) {
          detail.openDetail()
          nav.focusDetail()
          rd.fetchDetail(item.name)
        }
      }
      if (key.name === "g") nav.resetRow()
      if (key.raw === "G") nav.jumpToEnd(Math.max(0, rd.items().length - 1))
    }

    if (nav.pane() === "detail") {
      if (key.name === "h" || key.name === "left") { if (!detail.logsExpanded()) nav.focusList() }
      if (key.raw === "L" || key.raw === "l") detail.toggleLogs()
      if (key.raw === "F") detail.toggleLogsExpanded()
      if (detail.detailView() === "info") {
        if (key.name === "j" || key.name === "down") rd.setDetailScroll(s => s + 1)
        if (key.name === "k" || key.name === "up") rd.setDetailScroll(s => Math.max(0, s - 1))
        if (key.name === "g") rd.setDetailScroll(0)
      }
    }
  })

  const detailContent = () => {
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
        <text content="C:cluster N:ns " fg={C.dim} />
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
                  return (
                    <box height={1} paddingLeft={1} backgroundColor={isSel() ? C.sel : C.sidebar}>
                      <text content={`${isActive() ? "▸" : " "} ${rt}${count()}`} fg={isSel() ? C.bright : isActive() ? C.accent : C.text} />
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
            <Show when={detail.detailView() === "info"}>
              <box flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={C.sidebar}>
                <text content={truncate(`${rd.activeType()}/${selected()?.name ?? ""}`, detailW() - 4)} fg={C.bright} height={1} />
              </box>
              <box flexGrow={1} paddingLeft={1}>
                <text content={detailContent()} fg={C.text} />
              </box>
            </Show>
            <Show when={detail.detailView() === "logs"}>
              <box height={1} paddingLeft={1} backgroundColor={C.sidebar}>
                <text content={truncate(selected()?.name ?? "?", (detail.logsExpanded() ? dims().width - nav.sidebarW() : detailW()) - 16)} fg={C.accent} />
                <box flexGrow={1} />
                <text content={detail.logsExpanded() ? " F:collapse " : " F:expand "} fg={C.dim} />
              </box>
              <box flexGrow={1} alignItems="center" justifyContent="center">
                <text content="Log streaming not yet connected" fg={C.dim} />
              </box>
            </Show>
          </box>
        </Show>
      </box>

      <box height={1} flexDirection="row" paddingLeft={1} backgroundColor={C.sidebar}>
        <text content={`[${nav.pane().toUpperCase()}${detail.detailView() === "logs" && detail.detailOpen() ? "/LOGS" : ""}]`} fg={C.accent} />
        <text content={`  ${rd.items().length > 0 ? `${nav.rowIdx() + 1}/${rd.items().length}` : "empty"}`} fg={C.muted} />
        <Show when={!detail.detailOpen()}>
          <text content="  j/k:nav  Enter:detail  Tab:pane" fg={C.dim} />
        </Show>
        <Show when={detail.detailOpen() && !detail.logsExpanded()}>
          <text content="  L:logs  F:expand  h/l:pane  Esc:back" fg={C.dim} />
        </Show>
        <Show when={detail.logsExpanded()}>
          <text content="  F:collapse  Esc:back" fg={C.dim} />
        </Show>
      </box>
    </box>
  )
}
