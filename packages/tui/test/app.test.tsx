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

describe("App shell", () => {
  let setup: Awaited<ReturnType<typeof testRender>>

  beforeEach(async () => {
    _resetRouteState()
    setup = await testRender(() => <App />, { width: 80, height: 24 })
    await setup.renderOnce()
  })

  afterEach(() => {
    setup.renderer.destroy()
  })

  it("renders without crashing", () => {
    expect(setup.renderer.currentRenderBuffer).toBeDefined()
  })

  it("starts on clusters screen", () => {
    expect(route().screen).toBe("clusters")
  })

  it("Esc does nothing on clusters screen", async () => {
    keypress(setup, "escape")
    await setup.renderOnce()
    expect(route().screen).toBe("clusters")
  })

  it("Esc goes back from namespaces", async () => {
    navigateTo({ screen: "namespaces", cluster: "test-cluster" })
    await setup.renderOnce()
    keypress(setup, "escape")
    await setup.renderOnce()
    expect(route().screen).toBe("clusters")
  })

  it("backspace goes back from namespaces", async () => {
    navigateTo({ screen: "namespaces", cluster: "test-cluster" })
    await setup.renderOnce()
    keypress(setup, "backspace")
    await setup.renderOnce()
    expect(route().screen).toBe("clusters")
  })
})
