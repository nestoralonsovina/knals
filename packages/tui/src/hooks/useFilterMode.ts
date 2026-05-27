import { createSignal, createMemo, type Accessor } from "solid-js"

export function useFilterMode(items: Accessor<string[]>) {
  const [filterMode, setFilterMode] = createSignal(false)
  const [filterText, setFilterText] = createSignal("")

  const filtered = createMemo(() => {
    const f = filterText().toLowerCase()
    return f ? items().filter(ns => ns.toLowerCase().includes(f)) : items()
  })

  function enterFilter() {
    setFilterMode(true)
    setFilterText("")
  }

  function exitFilter() {
    setFilterMode(false)
  }

  function confirmFilter() {
    setFilterMode(false)
  }

  function handleFilterKey(key: { name?: string; raw?: string; ctrl?: boolean; meta?: boolean }): boolean {
    if (!filterMode()) return false
    if (key.name === "escape") { exitFilter(); return true }
    if (key.name === "return") { confirmFilter(); return true }
    if (key.name === "backspace") { setFilterText(v => v.slice(0, -1)); return true }
    if (key.raw?.length === 1 && !key.ctrl && !key.meta) { setFilterText(v => v + key.raw); return true }
    return true
  }

  return {
    filterMode,
    filterText,
    filtered,
    enterFilter,
    exitFilter,
    handleFilterKey,
  }
}
