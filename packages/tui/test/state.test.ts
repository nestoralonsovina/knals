import { describe, it, expect, beforeEach } from "bun:test"
import { createRouteState } from "../src/state"

describe("route state", () => {
  let state: ReturnType<typeof createRouteState>

  beforeEach(() => {
    state = createRouteState()
  })

  it("starts on the clusters screen", () => {
    expect(state.route().screen).toBe("clusters")
  })

  it("navigates to namespaces", () => {
    state.navigateTo({ screen: "namespaces", cluster: "kind-knals" })
    expect(state.route().screen).toBe("namespaces")
    expect((state.route() as any).cluster).toBe("kind-knals")
  })

  it("navigates to resources", () => {
    state.navigateTo({
      screen: "resources",
      cluster: "kind-knals",
      namespace: "team-api",
    })
    expect(state.route().screen).toBe("resources")
  })

  describe("goBack", () => {
    it("does nothing on clusters screen", () => {
      state.goBack()
      expect(state.route().screen).toBe("clusters")
    })

    it("goes from namespaces to clusters", () => {
      state.navigateTo({ screen: "namespaces", cluster: "kind-knals" })
      state.goBack()
      expect(state.route().screen).toBe("clusters")
    })

    it("goes from resources to namespaces, preserving cluster", () => {
      state.navigateTo({
        screen: "resources",
        cluster: "kind-knals",
        namespace: "team-api",
      })
      state.goBack()
      expect(state.route().screen).toBe("namespaces")
      expect((state.route() as any).cluster).toBe("kind-knals")
    })
  })

  describe("breadcrumb", () => {
    it("shows 'knals' on clusters screen", () => {
      expect(state.breadcrumb()).toBe("knals")
    })

    it("shows cluster name on namespaces screen", () => {
      state.navigateTo({ screen: "namespaces", cluster: "kind-knals" })
      expect(state.breadcrumb()).toBe("kind-knals")
    })

    it("shows cluster and namespace on resources screen", () => {
      state.navigateTo({
        screen: "resources",
        cluster: "kind-knals",
        namespace: "team-api",
      })
      expect(state.breadcrumb()).toBe("kind-knals ❯ team-api")
    })
  })
})
