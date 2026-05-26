import type { SelectOption } from "@opentui/core"
import { navigateTo } from "../app"

export function NamespacesScreen(props: { cluster: string; namespaces?: string[] }) {
  const options = (): SelectOption[] =>
    (props.namespaces ?? []).map((ns) => ({
      name: ns,
      description: "namespace",
      value: ns,
    }))

  function handleSelect(_index: number, option: SelectOption | null) {
    if (option) {
      navigateTo({
        screen: "resources",
        cluster: props.cluster,
        namespace: option.value,
        resourceType: "pods",
      })
    }
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <text content="Namespace Memory" fg="#94a3b8" height={1} />
      <select
        options={options()}
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
        onSelect={handleSelect}
      />
    </box>
  )
}
