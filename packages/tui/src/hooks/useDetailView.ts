import { createSignal } from "solid-js"

export type DetailViewMode = "describe" | "yaml" | "logs"

export function useDetailView() {
  const [detailOpen, setDetailOpen] = createSignal(false)
  const [detailView, setDetailView] = createSignal<DetailViewMode>("describe")
  const [logsExpanded, setLogsExpanded] = createSignal(false)

  function openDetail() {
    setDetailOpen(true)
    setDetailView("describe")
    setLogsExpanded(false)
  }

  function closeDetail() {
    setDetailOpen(false)
  }

  function toggleYaml() {
    setDetailView(v => v === "yaml" ? "describe" : "yaml")
    setLogsExpanded(false)
  }

  function toggleLogs() {
    setDetailView(v => v === "logs" ? "describe" : "logs")
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
    toggleYaml,
    toggleLogs,
    toggleLogsExpanded,
    resetOnTypeChange,
  }
}
