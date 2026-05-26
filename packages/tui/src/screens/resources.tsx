import { createSignal } from "solid-js"
import type { SelectOption } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { RESOURCE_TYPES, type ResourceType } from "../state"

export function ResourcesScreen(props: { cluster: string; namespace: string; resourceType: ResourceType }) {
  const [typeIndex, setTypeIndex] = createSignal(RESOURCE_TYPES.indexOf(props.resourceType))

  const activeType = () => RESOURCE_TYPES[typeIndex()]

  useKeyboard((key) => {
    if (key.name === "l" || key.name === "right") {
      setTypeIndex((i) => (i + 1) % RESOURCE_TYPES.length)
    }
    if (key.name === "h" || key.name === "left") {
      setTypeIndex((i) => (i - 1 + RESOURCE_TYPES.length) % RESOURCE_TYPES.length)
    }
  })

  const tabHeader = () =>
    RESOURCE_TYPES.map((rt, i) => {
      const label = `${rt} (0)`
      return i === typeIndex() ? `[${label}]` : ` ${label} `
    }).join("  ")

  return (
    <box flexDirection="column" flexGrow={1}>
      <text content={tabHeader()} fg="#94a3b8" height={1} />
      <select
        options={[] as SelectOption[]}
        focused={true}
        showDescription={true}
        showScrollIndicator={true}
        wrapSelection={true}
        backgroundColor="#1a1a2e"
        focusedBackgroundColor="#16213e"
        textColor="#e2e8f0"
        focusedTextColor="#f8fafc"
        selectedBackgroundColor="#3b82f6"
        selectedTextColor="#ffffff"
        descriptionColor="#64748b"
        selectedDescriptionColor="#94a3b8"
        flexGrow={1}
      />
    </box>
  )
}
