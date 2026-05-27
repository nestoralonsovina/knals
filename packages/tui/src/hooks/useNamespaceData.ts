import { createSignal, createResource, onMount } from "solid-js"
import {
  getClustersByCtxNamespaces,
  postClustersByCtxNamespacesDiscover,
} from "@knals/sdk"

export function useNamespaceData(cluster: () => string) {
  const [statusMessage, setStatusMessage] = createSignal("")

  const [namespaces, { refetch }] = createResource(
    cluster,
    async (ctx) => {
      const result = await getClustersByCtxNamespaces({ path: { ctx } })
      return result.data ?? []
    }
  )

  function showStatus(msg: string) {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(""), 3000)
  }

  async function discoverNamespaces() {
    try {
      const result = await postClustersByCtxNamespacesDiscover({
        path: { ctx: cluster() },
      })
      const newOnes = (result.data as string[] | undefined) ?? []
      if (newOnes.length > 0) {
        showStatus(`Discovered ${newOnes.length} namespace${newOnes.length > 1 ? "s" : ""}`)
        refetch()
      }
    } catch { /* discovery unavailable */ }
  }

  onMount(() => { discoverNamespaces() })

  const currentNamespaces = () => namespaces() ?? []

  return {
    namespaces: currentNamespaces,
    statusMessage,
    discoverNamespaces,
    refetch,
    showStatus,
  }
}
