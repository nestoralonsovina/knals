import type { SelectOption } from "@opentui/core"
import { navigateTo } from "../app"

export function ClustersScreen(props: { clusters?: { name: string; server: string; user: string; connected: boolean }[] }) {
  const options = (): SelectOption[] =>
    (props.clusters ?? []).map((c) => ({
      name: `${c.connected ? "● " : "  "}${c.name}`,
      description: `${c.server}  (${c.user})`,
      value: c.name,
    }))

  function handleSelect(_index: number, option: SelectOption | null) {
    if (option) {
      navigateTo({ screen: "namespaces", cluster: option.value })
    }
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <text content="Clusters" fg="#94a3b8" height={1} />
      <select
        options={options()}
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
        onSelect={handleSelect}
      />
    </box>
  )
}
