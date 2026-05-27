import { createSignal, createResource, Show } from "solid-js"
import type { SelectOption } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import {
  getClustersByCtxNamespaces,
  postClustersByCtxNamespaces,
  deleteClustersByCtxNamespacesByNs,
} from "@knals/sdk"
import { navigateTo } from "../app"

export function NamespacesScreen(props: { cluster: string }) {
  const [namespaces, { refetch }] = createResource(
    () => props.cluster,
    async (ctx) => {
      const result = await getClustersByCtxNamespaces({ path: { ctx } })
      return result.data ?? []
    }
  )

  const [inputMode, setInputMode] = createSignal(false)
  const [inputValue, setInputValue] = createSignal("")
  const [inputError, setInputError] = createSignal("")
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [statusMessage, setStatusMessage] = createSignal("")

  function showStatus(msg: string) {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(""), 3000)
  }

  useKeyboard((key) => {
    if (inputMode()) {
      if (key.name === "escape") {
        setInputMode(false)
        setInputValue("")
        setInputError("")
      } else if (key.name === "return") {
        const name = inputValue().trim()
        if (name) {
          addNamespace(name)
        }
      } else if (key.name === "backspace") {
        setInputValue((v) => v.slice(0, -1))
        setInputError("")
      } else if (key.raw && key.raw.length === 1 && !key.ctrl && !key.meta) {
        setInputValue((v) => v + key.raw)
        setInputError("")
      }
      return
    }

    if (key.name === "a") {
      setInputMode(true)
      setInputValue("")
      setInputError("")
    }

    if (key.name === "d") {
      const ns = currentNamespaces()
      if (ns.length > 0) {
        removeNamespace(ns[selectedIndex()])
      }
    }

    if (key.name === "return") {
      const ns = currentNamespaces()
      if (ns.length > 0) {
        navigateTo({
          screen: "resources",
          cluster: props.cluster,
          namespace: ns[selectedIndex()],
          resourceType: "pods",
        })
      }
    }

    if (key.name === "j" || key.name === "down") {
      setSelectedIndex((i) => Math.min(i + 1, currentNamespaces().length - 1))
    }
    if (key.name === "k" || key.name === "up") {
      setSelectedIndex((i) => Math.max(i - 1, 0))
    }
  })

  function currentNamespaces(): string[] {
    return namespaces() ?? []
  }

  async function addNamespace(name: string) {
    const result = await postClustersByCtxNamespaces({
      path: { ctx: props.cluster },
      body: { name },
    })
    if (result.error) {
      setInputError("Namespace not found or not accessible")
      return
    }
    setInputMode(false)
    setInputValue("")
    setInputError("")
    showStatus(`Added ${name}`)
    refetch()
  }

  async function removeNamespace(name: string) {
    await deleteClustersByCtxNamespacesByNs({
      path: { ctx: props.cluster, ns: name },
    })
    showStatus(`Removed ${name}`)
    refetch()
    setSelectedIndex((i) => Math.max(0, Math.min(i, currentNamespaces().length - 2)))
  }

  const options = (): SelectOption[] =>
    currentNamespaces().map((ns, i) => ({
      name: i === selectedIndex() ? `> ${ns}` : `  ${ns}`,
      description: "",
      value: ns,
    }))

  return (
    <box flexDirection="column" flexGrow={1}>
      <text content="Namespace Memory" fg="#94a3b8" height={1} />
      <Show
        when={currentNamespaces().length > 0}
        fallback={
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <text content='No namespaces yet. Press "a" to add one.' fg="#64748b" />
          </box>
        }
      >
        <select
          options={options()}
          focused={!inputMode()}
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
          onSelect={(_index, option) => {
            if (option) {
              navigateTo({
                screen: "resources",
                cluster: props.cluster,
                namespace: option.value,
                resourceType: "pods",
              })
            }
          }}
        />
      </Show>
      <Show when={inputMode()}>
        <box height={1} flexDirection="row" padding={1}>
          <text content={`Add namespace: ${inputValue()}█`} fg="#e2e8f0" />
        </box>
        <Show when={inputError()}>
          <box height={1} padding={1}>
            <text content={inputError()} fg="#ef4444" />
          </box>
        </Show>
      </Show>
      <Show when={statusMessage()}>
        <box height={1} padding={1}>
          <text content={statusMessage()} fg="#22c55e" />
        </box>
      </Show>
    </box>
  )
}
