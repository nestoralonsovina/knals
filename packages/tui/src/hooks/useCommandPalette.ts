import { createSignal, createMemo, type Accessor } from "solid-js"
import { commandContext } from "../lib/command-context"
import { matchCommands, type MatchResult } from "../lib/command-matching"
import type { Command } from "../lib/commands"

interface KeyEvent {
  name?: string
  raw?: string
  ctrl?: boolean
  meta?: boolean
}

const [paletteOpen, setPaletteOpen] = createSignal(false)
let _paletteHandledKey = false
export { paletteOpen }
export function paletteHandledKey() { return _paletteHandledKey }

export function useCommandPalette(registry: Accessor<Command[]>) {
  const [input, setInput] = createSignal("")
  const [cursor, setCursor] = createSignal(0)
  const [showAll, setShowAll] = createSignal(false)

  const results = createMemo((): MatchResult[] => {
    if (!paletteOpen()) return []
    return matchCommands(input(), registry(), commandContext(), showAll())
  })

  function open() {
    setInput("")
    setCursor(0)
    setShowAll(false)
    setPaletteOpen(true)
  }

  function close() {
    setPaletteOpen(false)
  }

  function executeSelected() {
    const match = results()[cursor()]
    if (match && match.available) {
      close()
      match.command.execute(commandContext())
    }
  }

  function handleKey(key: KeyEvent): boolean {
    _paletteHandledKey = false
    if (!paletteOpen()) {
      if (key.raw === ":") {
        open()
        _paletteHandledKey = true
        return true
      }
      return false
    }

    _paletteHandledKey = true
    if (key.name === "escape") { close(); return true }
    if (key.name === "return") { executeSelected(); return true }
    if (key.name === "tab") { setShowAll(v => !v); setCursor(0); return true }

    if (key.name === "j" || key.name === "down") {
      setCursor(c => Math.min(c + 1, results().length - 1))
      return true
    }
    if (key.name === "k" || key.name === "up") {
      setCursor(c => Math.max(c - 1, 0))
      return true
    }

    if (key.name === "backspace") {
      setInput(v => v.slice(0, -1))
      setCursor(0)
      return true
    }

    if (key.raw?.length === 1 && !key.ctrl && !key.meta) {
      setInput(v => v + key.raw)
      setCursor(0)
      return true
    }

    return true
  }

  return {
    open: paletteOpen,
    input,
    cursor,
    showAll,
    results,
    handleKey,
    close,
  }
}
