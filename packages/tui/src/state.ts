import { createSignal } from "solid-js"

export const RESOURCE_TYPES = ["pods", "deployments", "services"] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export type Route =
  | { screen: "clusters" }
  | { screen: "namespaces"; cluster: string }
  | { screen: "resources"; cluster: string; namespace: string; resourceType: ResourceType }

export function createRouteState() {
  const [route, setRoute] = createSignal<Route>({ screen: "clusters" })

  function navigateTo(r: Route) {
    setRoute(r)
  }

  function goBack() {
    const current = route()
    switch (current.screen) {
      case "clusters":
        break
      case "namespaces":
        setRoute({ screen: "clusters" })
        break
      case "resources":
        setRoute({ screen: "namespaces", cluster: current.cluster })
        break
    }
  }

  function breadcrumb(): string {
    const current = route()
    switch (current.screen) {
      case "clusters":
        return "knals"
      case "namespaces":
        return `knals > ${current.cluster}`
      case "resources":
        return `knals > ${current.cluster} > ${current.namespace}`
    }
  }

  return { route, navigateTo, goBack, breadcrumb }
}
