import { createSignal } from "solid-js"
import { postClustersByCtxNamespaces } from "@knals/sdk"

export function useAddMode(cluster: () => string, onAdded: (name: string) => void) {
  const [addMode, setAddMode] = createSignal(false)
  const [addValue, setAddValue] = createSignal("")
  const [addError, setAddError] = createSignal("")

  function enterAdd() {
    setAddMode(true)
    setAddValue("")
    setAddError("")
  }

  function exitAdd() {
    setAddMode(false)
    setAddValue("")
    setAddError("")
  }

  async function submitAdd() {
    const name = addValue().trim()
    if (!name) return
    const result = await postClustersByCtxNamespaces({
      path: { ctx: cluster() },
      body: { name },
    })
    if (result.error) {
      setAddError("Namespace not found or not accessible")
      return
    }
    exitAdd()
    onAdded(name)
  }

  function handleAddKey(key: { name?: string; raw?: string; ctrl?: boolean; meta?: boolean }): boolean {
    if (!addMode()) return false
    if (key.name === "escape") { exitAdd(); return true }
    if (key.name === "return") { submitAdd(); return true }
    if (key.name === "backspace") { setAddValue(v => v.slice(0, -1)); setAddError(""); return true }
    if (key.raw?.length === 1 && !key.ctrl && !key.meta) { setAddValue(v => v + key.raw); setAddError(""); return true }
    return true
  }

  return {
    addMode,
    addValue,
    addError,
    enterAdd,
    handleAddKey,
  }
}
