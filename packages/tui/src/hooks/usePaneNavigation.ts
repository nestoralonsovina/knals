import { createSignal } from "solid-js"

export type Pane = "sidebar" | "list" | "detail"

export function usePaneNavigation() {
  const [pane, setPane] = createSignal<Pane>("list")
  const [sidebarCursor, setSidebarCursor] = createSignal(0)
  const [rowIdx, setRowIdx] = createSignal(0)
  const [sidebarW, setSidebarW] = createSignal(20)

  function focusSidebar() { setPane("sidebar") }
  function focusList() { setPane("list") }
  function focusDetail() { setPane("detail") }

  function cyclePane(detailOpen: boolean, logsExpanded: boolean) {
    if (detailOpen && !logsExpanded) {
      const panes: Pane[] = ["sidebar", "list", "detail"]
      setPane(panes[(panes.indexOf(pane()) + 1) % panes.length])
    } else {
      setPane(pane() === "sidebar" ? "list" : "sidebar")
    }
  }

  function resizeSidebar(delta: number) {
    setSidebarW(w => Math.max(14, Math.min(34, w + delta)))
  }

  function moveRow(delta: number, maxIdx: number) {
    setRowIdx(i => Math.max(0, Math.min(i + delta, maxIdx)))
  }

  function moveSidebarCursor(delta: number, maxIdx: number) {
    setSidebarCursor(i => Math.max(0, Math.min(i + delta, maxIdx)))
  }

  function resetRow() { setRowIdx(0) }
  function jumpToEnd(maxIdx: number) { setRowIdx(maxIdx) }

  return {
    pane,
    sidebarCursor,
    rowIdx,
    sidebarW,
    focusSidebar,
    focusList,
    focusDetail,
    cyclePane,
    resizeSidebar,
    moveRow,
    moveSidebarCursor,
    resetRow,
    jumpToEnd,
  }
}
