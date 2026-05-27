import { createSignal, createEffect, onCleanup, Show, For } from "solid-js"
import type { SelectOption } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { RESOURCE_TYPES, type ResourceType } from "../state"
import { getClustersByCtxNamespacesByNsResourcesByType } from "@knals/sdk"
import { navigateTo } from "../app"

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

export function ResourcesScreen(props: { cluster: string; namespace: string; resourceType: ResourceType }) {
  const [typeIndex, setTypeIndex] = createSignal(RESOURCE_TYPES.indexOf(props.resourceType))
  const [data, setData] = createSignal<ResourceData | null>(null)
  const [selectedRow, setSelectedRow] = createSignal(0)
  const [error, setError] = createSignal("")

  const activeType = () => RESOURCE_TYPES[typeIndex()]

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

  createEffect(() => {
    const _ = activeType()
    setData(null)
    setSelectedRow(0)
    fetchResources()
  })

  const pollInterval = setInterval(fetchResources, 2000)
  onCleanup(() => clearInterval(pollInterval))

  useKeyboard((key) => {
    if (key.name === "l" || key.name === "right") {
      setTypeIndex((i) => (i + 1) % RESOURCE_TYPES.length)
    }
    if (key.name === "h" || key.name === "left") {
      setTypeIndex((i) => (i - 1 + RESOURCE_TYPES.length) % RESOURCE_TYPES.length)
    }
    if (key.name === "j" || key.name === "down") {
      const items = data()?.items ?? []
      setSelectedRow((i) => Math.min(i + 1, items.length - 1))
    }
    if (key.name === "k" || key.name === "up") {
      setSelectedRow((i) => Math.max(i - 1, 0))
    }
    if (key.name === "return") {
      const items = data()?.items ?? []
      if (items.length > 0) {
        const item = items[selectedRow()]
        navigateTo({
          screen: "detail",
          cluster: props.cluster,
          namespace: props.namespace,
          resourceType: activeType(),
          resourceName: item.name,
        })
      }
    }
  })

  const tabHeader = () =>
    RESOURCE_TYPES.map((rt, i) => {
      const count = rt === activeType() ? (data()?.items?.length ?? 0) : 0
      const label = rt === activeType() ? `${rt} (${count})` : rt
      return i === typeIndex() ? `[${label}]` : ` ${label} `
    }).join(" ")

  function formatRow(item: ResourceItem, index: number): string {
    const prefix = index === selectedRow() ? ">" : " "
    return `${prefix} ${item.cells.join("  ")}`
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <text content={tabHeader()} fg="#94a3b8" height={1} />
      <Show
        when={(data()?.items?.length ?? 0) > 0}
        fallback={
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <text
              content={error() || `No ${activeType()} found`}
              fg={error() ? "#ef4444" : "#64748b"}
            />
          </box>
        }
      >
        <select
          options={
            (data()?.items ?? []).map((item, i) => ({
              name: formatRow(item, i),
              description: "",
              value: item.name,
            })) as SelectOption[]
          }
          focused={true}
          showDescription={false}
          showScrollIndicator={true}
          wrapSelection={true}
          backgroundColor="#1a1a2e"
          focusedBackgroundColor="#16213e"
          textColor="#e2e8f0"
          focusedTextColor="#f8fafc"
          selectedBackgroundColor="#3b82f6"
          selectedTextColor="#ffffff"
          flexGrow={1}
        />
      </Show>
      <Show when={error()}>
        <box height={1} padding={1}>
          <text content={error()} fg="#ef4444" />
        </box>
      </Show>
    </box>
  )
}
