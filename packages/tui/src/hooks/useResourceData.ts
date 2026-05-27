import { createSignal, createEffect, onCleanup } from "solid-js"
import {
  getResourcesTypes,
  getClustersByCtxNamespacesByNsResourcesByType,
  getClustersByCtxNamespacesByNsResourcesByTypeByName,
} from "@knals/sdk"

export interface ResourceItem {
  name: string
  namespace: string
  cells: string[]
  creationTimestamp: string
}

export interface ResourceData {
  kind: string
  columns: string[]
  items: ResourceItem[]
}

export function useResourceData(cluster: () => string, namespace: () => string) {
  const [resourceTypes, setResourceTypes] = createSignal<string[]>([])
  const [typeIdx, setTypeIdx] = createSignal(0)
  const [data, setData] = createSignal<ResourceData | null>(null)
  const [error, setError] = createSignal("")
  const [detailJson, setDetailJson] = createSignal("")
  const [detailScroll, setDetailScroll] = createSignal(0)

  const activeType = () => resourceTypes()[typeIdx()]
  const items = () => data()?.items ?? []
  const columns = () => data()?.columns ?? []

  async function fetchResourceTypes() {
    try {
      const result = await getResourcesTypes()
      const types = (result.data as any[] | undefined) ?? []
      setResourceTypes(types.map((t: any) => t.name))
    } catch {
      setResourceTypes(["pods", "deployments", "services"])
    }
  }

  async function fetchResources() {
    const type = activeType()
    if (!type) return
    try {
      const result = await getClustersByCtxNamespacesByNsResourcesByType({
        path: { ctx: cluster(), ns: namespace(), type },
      })
      if (result.data) {
        setData(result.data as unknown as ResourceData)
        setError("")
      }
    } catch {
      setError("Failed to fetch resources")
    }
  }

  async function fetchDetail(name: string) {
    try {
      const result = await getClustersByCtxNamespacesByNsResourcesByTypeByName({
        path: { ctx: cluster(), ns: namespace(), type: activeType(), name },
      })
      if (result.data) {
        setDetailJson(JSON.stringify(result.data, null, 2))
      } else {
        setDetailJson("Resource not found")
      }
    } catch {
      setDetailJson("Failed to load resource")
    }
    setDetailScroll(0)
  }

  function selectType(idx: number) {
    setTypeIdx(idx)
  }

  fetchResourceTypes()

  createEffect(() => {
    const _ = activeType()
    setData(null)
    fetchResources()
  })

  const pollInterval = setInterval(fetchResources, 2000)
  onCleanup(() => clearInterval(pollInterval))

  return {
    resourceTypes,
    typeIdx,
    activeType,
    data,
    items,
    columns,
    error,
    detailJson,
    detailScroll,
    setDetailScroll,
    selectType,
    fetchDetail,
  }
}
