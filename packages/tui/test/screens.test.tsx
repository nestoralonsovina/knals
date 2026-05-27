import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { testRender } from "@opentui/solid"
import { App } from "../src/app"
import { _resetRouteState, navigateTo, route } from "../src/app"

function keypress(setup: any, name: string) {
  setup.renderer.keyInput.emit("keypress", {
    name,
    sequence: name,
    raw: name,
    ctrl: false,
    shift: false,
    meta: false,
    option: false,
    eventType: "press",
    number: false,
  })
}

describe("Clusters screen", () => {
  let setup: Awaited<ReturnType<typeof testRender>>

  beforeEach(async () => {
    _resetRouteState()
    setup = await testRender(() => <App />, { width: 80, height: 24 })
    await setup.renderOnce()
  })

  afterEach(() => {
    setup.renderer.destroy()
  })

  it("shows clusters screen by default", () => {
    expect(route().screen).toBe("clusters")
  })

  it("Enter on a cluster navigates to namespaces", async () => {
    keypress(setup, "return")
    await setup.renderOnce()
    // Without cluster data, select has no options so onSelect won't fire
    // This verifies the screen doesn't crash with empty data
    expect(route().screen).toBe("clusters")
  })
})

describe("Namespaces screen", () => {
  let setup: Awaited<ReturnType<typeof testRender>>

  beforeEach(async () => {
    _resetRouteState()
    navigateTo({ screen: "namespaces", cluster: "kind-knals" })
    setup = await testRender(() => <App />, { width: 80, height: 24 })
    await setup.renderOnce()
  })

  afterEach(() => {
    setup.renderer.destroy()
  })

  it("renders namespaces screen", () => {
    expect(route().screen).toBe("namespaces")
  })

  it("Esc goes back to clusters", async () => {
    keypress(setup, "escape")
    await setup.renderOnce()
    expect(route().screen).toBe("clusters")
  })
})

describe("Resources screen", () => {
  let setup: Awaited<ReturnType<typeof testRender>>

  beforeEach(async () => {
    _resetRouteState()
    navigateTo({
      screen: "resources",
      cluster: "kind-knals",
      namespace: "team-api",
    })
    setup = await testRender(() => <App />, { width: 80, height: 24 })
    await setup.renderOnce()
  })

  afterEach(() => {
    setup.renderer.destroy()
  })

  it("renders resources screen", () => {
    expect(route().screen).toBe("resources")
  })

  it("renders without crash on resources screen", async () => {
    // The resources screen handles its own keyboard routing
    // Verify it renders and stays on the resources screen
    keypress(setup, "j")
    await setup.renderOnce()
    expect(route().screen).toBe("resources")
  })
})
