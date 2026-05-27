import { createSignal, createResource, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { getClustersByCtxNamespacesByNsResourcesByTypeByName } from "@knals/sdk"
import type { ResourceType } from "../state"

export function DetailScreen(props: {
  cluster: string
  namespace: string
  resourceType: ResourceType
  resourceName: string
}) {
  const [scrollOffset, setScrollOffset] = createSignal(0)

  const [resource] = createResource(
    () => ({ ctx: props.cluster, ns: props.namespace, type: props.resourceType, name: props.resourceName }),
    async (params) => {
      try {
        const result = await getClustersByCtxNamespacesByNsResourcesByTypeByName({
          path: params,
        })
        if (result.data) {
          return JSON.stringify(result.data, null, 2)
        }
        return "Failed to load resource"
      } catch {
        return "Failed to load resource"
      }
    }
  )

  useKeyboard((key) => {
    if (key.name === "j" || key.name === "down") {
      setScrollOffset((o) => o + 1)
    }
    if (key.name === "k" || key.name === "up") {
      setScrollOffset((o) => Math.max(0, o - 1))
    }
    if (key.name === "g") {
      setScrollOffset(0)
    }
  })

  function colorizeJson(json: string): string {
    return json
  }

  const visibleContent = () => {
    const text = resource() ?? "Loading..."
    const lines = text.split("\n")
    const offset = Math.min(scrollOffset(), Math.max(0, lines.length - 1))
    return lines.slice(offset).join("\n")
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <text
        content={`${props.resourceType}/${props.resourceName}`}
        fg="#94a3b8"
        height={1}
      />
      <Show when={!resource.loading} fallback={
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text content="Loading..." fg="#64748b" />
        </box>
      }>
        <box flexGrow={1}>
          <text content={visibleContent()} fg="#e2e8f0" />
        </box>
      </Show>
    </box>
  )
}
