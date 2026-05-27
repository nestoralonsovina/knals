import { describe, it, expect } from "bun:test"
import { matchCommands } from "../src/lib/command-matching"
import type { Command } from "../src/lib/commands"
import type { CommandContext } from "../src/lib/command-context"

function cmd(id: string, label: string, requires: Command["requires"] = {}): Command {
  return { id, label, requires, execute: () => {} }
}

const commands: Command[] = [
  cmd("go-clusters", "Go to Clusters"),
  cmd("go-namespaces", "Go to Namespaces", { screen: ["namespaces", "resources"] }),
  cmd("go-pods", "Go to Pods", { screen: ["namespaces", "resources"] }),
  cmd("go-deployments", "Go to Deployments", { screen: ["namespaces", "resources"] }),
  cmd("quit", "Quit"),
  cmd("view-yaml", "View YAML", { screen: "resources", needsSelection: true }),
]

const clustersCtx: CommandContext = { screen: "clusters" }
const resourcesCtx: CommandContext = { screen: "resources", cluster: "c", namespace: "n", resourceType: "pods" }

describe("matchCommands", () => {
  it("returns all available commands with empty query", () => {
    const results = matchCommands("", commands, clustersCtx, false)
    const ids = results.map(r => r.command.id)
    expect(ids).toContain("go-clusters")
    expect(ids).toContain("quit")
    expect(ids).not.toContain("go-pods")
  })

  it("filters by substring match", () => {
    const results = matchCommands("pod", commands, resourcesCtx, false)
    expect(results).toHaveLength(1)
    expect(results[0].command.id).toBe("go-pods")
  })

  it("is case-insensitive", () => {
    const results = matchCommands("QUIT", commands, clustersCtx, false)
    expect(results).toHaveLength(1)
    expect(results[0].command.id).toBe("quit")
  })

  it("returns empty for no match", () => {
    const results = matchCommands("zzz", commands, clustersCtx, false)
    expect(results).toHaveLength(0)
  })

  it("ranks exact match first", () => {
    const results = matchCommands("quit", commands, clustersCtx, false)
    expect(results[0].command.id).toBe("quit")
  })

  it("ranks word-starts-with above contains", () => {
    const cmds = [
      cmd("argo", "Argo Workflows"),
      cmd("go-pods", "Go to Pods"),
    ]
    const results = matchCommands("go", cmds, clustersCtx, false)
    expect(results[0].command.id).toBe("go-pods")
    expect(results[1].command.id).toBe("argo")
  })

  it("excludes unavailable commands by default", () => {
    const results = matchCommands("", commands, clustersCtx, false)
    const ids = results.map(r => r.command.id)
    expect(ids).not.toContain("go-namespaces")
    expect(ids).not.toContain("view-yaml")
  })

  it("includes unavailable commands when showAll is true", () => {
    const results = matchCommands("", commands, clustersCtx, true)
    const ids = results.map(r => r.command.id)
    expect(ids).toContain("go-namespaces")
    expect(ids).toContain("view-yaml")
  })

  it("marks unavailable commands with reason", () => {
    const results = matchCommands("", commands, clustersCtx, true)
    const viewYaml = results.find(r => r.command.id === "view-yaml")!
    expect(viewYaml.available).toBe(false)
    expect(viewYaml.reason).toBeDefined()
  })

  it("marks available commands as available", () => {
    const results = matchCommands("", commands, clustersCtx, false)
    for (const r of results) {
      expect(r.available).toBe(true)
    }
  })

  it("filters with query 'dep' matches deployments", () => {
    const results = matchCommands("dep", commands, resourcesCtx, false)
    expect(results).toHaveLength(1)
    expect(results[0].command.id).toBe("go-deployments")
  })
})
