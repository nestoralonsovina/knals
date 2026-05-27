import { createSignal } from "solid-js"

export interface CommandContext {
  screen: "clusters" | "namespaces" | "resources"
  cluster?: string
  namespace?: string
  resourceType?: string
  selectedItem?: { name: string }
  canList?: (type: string) => boolean
}

const [commandContext, setCommandContext] = createSignal<CommandContext>({ screen: "clusters" })

export { commandContext, setCommandContext }

type ActionHandler = () => void
const actionHandlers = new Map<string, ActionHandler>()

export function onAction(id: string, handler: ActionHandler): () => void {
  actionHandlers.set(id, handler)
  return () => { actionHandlers.delete(id) }
}

export function dispatchAction(id: string) {
  actionHandlers.get(id)?.()
}
