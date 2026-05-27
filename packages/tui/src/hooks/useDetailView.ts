import { createSignal } from "solid-js"

export type DetailViewMode = "info" | "logs"

export function useDetailView() {
  const [detailOpen, setDetailOpen] = createSignal(false)
  const [detailView, setDetailView] = createSignal<DetailViewMode>("info")
  const [logsExpanded, setLogsExpanded] = createSignal(false)

  function openDetail() {
    setDetailOpen(true)
    setDetailView("info")
    setLogsExpanded(false)
  }

  function closeDetail() {
    setDetailOpen(false)
  }

  function toggleLogs() {
    setDetailView(v => v === "logs" ? "info" : "logs")
    setLogsExpanded(false)
  }

  function toggleLogsExpanded() {
    if (detailView() !== "logs") setDetailView("logs")
    setLogsExpanded(v => !v)
  }

  function resetOnTypeChange() {
    setDetailOpen(false)
    setLogsExpanded(false)
  }

  return {
    detailOpen,
    detailView,
    logsExpanded,
    openDetail,
    closeDetail,
    toggleLogs,
    toggleLogsExpanded,
    resetOnTypeChange,
  }
}
