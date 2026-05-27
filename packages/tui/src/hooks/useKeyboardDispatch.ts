import { useKeyboard } from "@opentui/solid"
import { navigateTo } from "../app"
import { paletteOpen, paletteHandledKey } from "./useCommandPalette"
import { commandContext } from "../lib/command-context"
import { isAvailable, type Command } from "../lib/commands"
import type { Pane } from "./usePaneNavigation"

interface KeyEvent {
  name?: string
  raw?: string
  ctrl?: boolean
  meta?: boolean
}

interface DispatchDeps {
  cluster: string
  pane: () => Pane
  nav: {
    focusList: () => void
    focusSidebar: () => void
    focusDetail: () => void
    cyclePane: (detailOpen: boolean, logsExpanded: boolean) => void
    resizeSidebar: (delta: number) => void
    moveSidebarCursor: (delta: number, maxIdx: number) => void
    moveRow: (delta: number, maxIdx: number) => void
    resetRow: () => void
    jumpToEnd: (maxIdx: number) => void
    sidebarCursor: () => number
  }
  detail: {
    detailOpen: () => boolean
    detailView: () => string
    logsExpanded: () => boolean
    toggleLogsExpanded: () => void
    toggleLogs: () => void
    closeDetail: () => void
    openDetail: () => void
    resetOnTypeChange: () => void
  }
  rd: {
    resourceTypes: () => string[]
    items: () => { name: string }[]
    selectType: (idx: number) => void
    fetchDetail: (name: string) => void
    setDetailScroll: (fn: number | ((prev: number) => number)) => void
    detailScroll: () => number
  }
  selected: () => { name: string } | undefined
  registry: () => Command[]
}

function handleEscapeCascade(key: KeyEvent, deps: DispatchDeps): boolean {
  if (key.name !== "escape") return false
  if (deps.detail.logsExpanded()) { deps.detail.toggleLogsExpanded(); return true }
  if (deps.detail.detailView() === "logs") { deps.detail.toggleLogs(); return true }
  if (deps.detail.detailOpen()) { deps.detail.closeDetail(); deps.nav.focusList(); return true }
  if (deps.pane() === "sidebar") { deps.nav.focusList(); return true }
  navigateTo({ screen: "namespaces", cluster: deps.cluster })
  return true
}

function handleSpatialKeys(key: KeyEvent, deps: DispatchDeps): boolean {
  if (key.name === "tab") { deps.nav.cyclePane(deps.detail.detailOpen(), deps.detail.logsExpanded()); return true }
  if (key.raw === "[") { deps.nav.resizeSidebar(-2); return true }
  if (key.raw === "]") { deps.nav.resizeSidebar(2); return true }
  return false
}

function handlePaneKeys(key: KeyEvent, deps: DispatchDeps): void {
  if (deps.pane() === "sidebar") {
    if (key.name === "j" || key.name === "down") deps.nav.moveSidebarCursor(1, deps.rd.resourceTypes().length - 1)
    if (key.name === "k" || key.name === "up") deps.nav.moveSidebarCursor(-1, deps.rd.resourceTypes().length - 1)
    if (key.name === "return" || key.name === "l" || key.name === "right") {
      deps.rd.selectType(deps.nav.sidebarCursor())
      deps.nav.resetRow()
      deps.detail.resetOnTypeChange()
      deps.nav.focusList()
    }
  }

  if (deps.pane() === "list") {
    if (key.name === "j" || key.name === "down") deps.nav.moveRow(1, deps.rd.items().length - 1)
    if (key.name === "k" || key.name === "up") deps.nav.moveRow(-1, deps.rd.items().length - 1)
    if (key.name === "h" || key.name === "left") deps.nav.focusSidebar()
    if (key.name === "l" || key.name === "right") { if (deps.detail.detailOpen()) deps.nav.focusDetail() }
    if (key.name === "return") {
      const item = deps.selected()
      if (item) {
        deps.detail.openDetail()
        deps.nav.focusDetail()
        deps.rd.fetchDetail(item.name)
      }
    }
    if (key.name === "g") deps.nav.resetRow()
    if (key.raw === "G") deps.nav.jumpToEnd(Math.max(0, deps.rd.items().length - 1))
  }

  if (deps.pane() === "detail") {
    if (key.name === "h" || key.name === "left") { if (!deps.detail.logsExpanded()) deps.nav.focusList() }
    if (key.raw === "L" || key.raw === "l") deps.detail.toggleLogs()
    if (key.raw === "F") deps.detail.toggleLogsExpanded()
    if (deps.detail.detailView() === "info") {
      if (key.name === "j" || key.name === "down") deps.rd.setDetailScroll((s: number) => s + 1)
      if (key.name === "k" || key.name === "up") deps.rd.setDetailScroll((s: number) => Math.max(0, s - 1))
      if (key.name === "g") deps.rd.setDetailScroll(0)
    }
  }
}

function handleRegistryShortcut(key: KeyEvent, deps: DispatchDeps): boolean {
  if (!key.raw || key.raw.length !== 1 || key.ctrl || key.meta) return false
  const ctx = commandContext()
  for (const cmd of deps.registry()) {
    if (cmd.shortcut === key.raw && isAvailable(cmd, ctx).available) {
      cmd.execute(ctx)
      return true
    }
  }
  return false
}

export function useKeyboardDispatch(deps: DispatchDeps) {
  useKeyboard((key) => {
    if (paletteOpen() || paletteHandledKey()) return
    if (handleEscapeCascade(key, deps)) return
    if (handleSpatialKeys(key, deps)) return
    if (handleRegistryShortcut(key, deps)) return
    handlePaneKeys(key, deps)
  })
}
