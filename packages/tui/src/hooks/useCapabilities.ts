import { createSignal, createEffect } from "solid-js"
import {
  getClustersByCtxNamespacesByNsCapabilities,
  postClustersByCtxNamespacesByNsCapabilitiesRefresh,
} from "@knals/sdk"

export type CapabilitySnapshot = Record<string, string[]>

export function useCapabilities(cluster: () => string, namespace: () => string) {
  const [snapshot, setSnapshot] = createSignal<CapabilitySnapshot | null>(null)

  async function fetchOrProbe() {
    const ctx = cluster()
    const ns = namespace()
    if (!ctx || !ns) return

    try {
      const cached = await getClustersByCtxNamespacesByNsCapabilities({
        path: { ctx, ns },
      })
      if (cached.response.status === 200 && cached.data) {
        setSnapshot(cached.data as CapabilitySnapshot)
        return
      }
    } catch { /* 404 or error, fall through to probe */ }

    await refresh()
  }

  async function refresh() {
    const ctx = cluster()
    const ns = namespace()
    if (!ctx || !ns) return

    try {
      const result = await postClustersByCtxNamespacesByNsCapabilitiesRefresh({
        path: { ctx, ns },
      })
      if (result.data) {
        setSnapshot(result.data as CapabilitySnapshot)
      }
    } catch { /* probe failed — leave snapshot null (optimistic) */ }
  }

  function canList(resourceType: string): boolean {
    const s = snapshot()
    if (!s) return true
    const verbs = s[resourceType]
    return verbs != null && verbs.includes("list")
  }

  createEffect(() => {
    const _ = namespace()
    fetchOrProbe()
  })

  return { snapshot, canList, refresh }
}
