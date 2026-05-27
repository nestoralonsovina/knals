import { describe, it, expect } from "bun:test"
import { isAvailable, buildRegistry, buildResourceTypeCommands, type Command } from "../src/lib/commands"
import type { CommandContext } from "../src/lib/command-context"

describe("command registry", () => {
  const registry = buildRegistry(["pods", "deployments", "services"])

  it("has unique IDs", () => {
    const ids = registry.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("has unique shortcuts among those that have them", () => {
    const shortcuts = registry.filter(c => c.shortcut).map(c => c.shortcut)
    expect(new Set(shortcuts).size).toBe(shortcuts.length)
  })

  it("has valid requires objects", () => {
    for (const cmd of registry) {
      expect(cmd.requires).toBeDefined()
      if (cmd.requires.screen) {
        const screens = Array.isArray(cmd.requires.screen) ? cmd.requires.screen : [cmd.requires.screen]
        for (const s of screens) {
          expect(["clusters", "namespaces", "resources"]).toContain(s)
        }
      }
    }
  })

  it("includes base commands", () => {
    const ids = registry.map(c => c.id)
    expect(ids).toContain("go-clusters")
    expect(ids).toContain("quit")
    expect(ids).toContain("go-namespaces")
    expect(ids).toContain("add-namespace")
    expect(ids).toContain("discover-namespaces")
    expect(ids).toContain("refresh")
    expect(ids).toContain("view-yaml")
  })

  it("includes resource type commands", () => {
    const ids = registry.map(c => c.id)
    expect(ids).toContain("go-pods")
    expect(ids).toContain("go-deployments")
    expect(ids).toContain("go-services")
  })

  it("generates resource type commands from types array", () => {
    const cmds = buildResourceTypeCommands(["configmaps", "secrets"])
    expect(cmds).toHaveLength(2)
    expect(cmds[0].id).toBe("go-configmaps")
    expect(cmds[0].label).toBe("Go to Configmaps")
    expect(cmds[1].id).toBe("go-secrets")
    expect(cmds[1].label).toBe("Go to Secrets")
  })
})

describe("isAvailable", () => {
  const cmd = (requires: Command["requires"]): Command => ({
    id: "test",
    label: "Test",
    requires,
    execute: () => {},
  })

  it("command with no requirements is always available", () => {
    const result = isAvailable(cmd({}), { screen: "clusters" })
    expect(result.available).toBe(true)
  })

  it("command with matching screen is available", () => {
    const result = isAvailable(cmd({ screen: "resources" }), { screen: "resources" })
    expect(result.available).toBe(true)
  })

  it("command with non-matching screen is unavailable", () => {
    const result = isAvailable(cmd({ screen: "resources" }), { screen: "clusters" })
    expect(result.available).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it("command with screen array matches any", () => {
    const c = cmd({ screen: ["namespaces", "resources"] })
    expect(isAvailable(c, { screen: "namespaces" }).available).toBe(true)
    expect(isAvailable(c, { screen: "resources" }).available).toBe(true)
    expect(isAvailable(c, { screen: "clusters" }).available).toBe(false)
  })

  it("command requiring selection is unavailable without it", () => {
    const result = isAvailable(cmd({ needsSelection: true }), { screen: "resources" })
    expect(result.available).toBe(false)
    expect(result.reason).toContain("select")
  })

  it("command requiring selection is available with it", () => {
    const result = isAvailable(
      cmd({ needsSelection: true }),
      { screen: "resources", selectedItem: { name: "my-pod" } },
    )
    expect(result.available).toBe(true)
  })

  it("command requiring resource type is available with matching type", () => {
    const result = isAvailable(
      cmd({ resourceType: ["pods"] }),
      { screen: "resources", resourceType: "pods" },
    )
    expect(result.available).toBe(true)
  })

  it("command requiring resource type is unavailable with wrong type", () => {
    const result = isAvailable(
      cmd({ resourceType: ["pods"] }),
      { screen: "resources", resourceType: "services" },
    )
    expect(result.available).toBe(false)
  })

  it("checks all requirements together", () => {
    const c = cmd({ screen: "resources", needsSelection: true, resourceType: ["pods"] })
    expect(isAvailable(c, { screen: "resources", resourceType: "pods", selectedItem: { name: "p" } }).available).toBe(true)
    expect(isAvailable(c, { screen: "resources", resourceType: "pods" }).available).toBe(false)
    expect(isAvailable(c, { screen: "resources", resourceType: "services", selectedItem: { name: "s" } }).available).toBe(false)
    expect(isAvailable(c, { screen: "clusters" }).available).toBe(false)
  })
})
