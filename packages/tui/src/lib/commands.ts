import { navigateTo } from "../app"
import { dispatchAction, type CommandContext } from "./command-context"

export interface CommandRequires {
  screen?: string | string[]
  resourceType?: string[]
  needsSelection?: boolean
}

export interface Command {
  id: string
  label: string
  shortcut?: string
  requires: CommandRequires
  available?: (ctx: CommandContext) => { available: boolean; reason?: string }
  execute: (ctx: CommandContext) => void
}

export function isAvailable(command: Command, ctx: CommandContext): { available: boolean; reason?: string } {
  const req = command.requires

  if (req.screen) {
    const screens = Array.isArray(req.screen) ? req.screen : [req.screen]
    if (!screens.includes(ctx.screen)) {
      return { available: false, reason: `requires ${screens.join(" or ")} screen` }
    }
  }

  if (req.resourceType) {
    if (!ctx.resourceType || !req.resourceType.includes(ctx.resourceType)) {
      return { available: false, reason: `requires ${req.resourceType.join(" or ")}` }
    }
  }

  if (req.needsSelection && !ctx.selectedItem) {
    return { available: false, reason: "select a resource first" }
  }

  if (command.available) {
    return command.available(ctx)
  }

  return { available: true }
}

const BASE_COMMANDS: Command[] = [
  {
    id: "go-clusters",
    label: "Go to Clusters",
    shortcut: "C",
    requires: {},
    execute: () => navigateTo({ screen: "clusters" }),
  },
  {
    id: "quit",
    label: "Quit",
    shortcut: "q",
    requires: {},
    execute: () => {
      process.stdout.write("\x1b[?1049l\x1b[?25h\x1b[0m\x1b[?1003l\x1b[?1002l\x1b[?1000l\x1b[?1006l\x1b[?2004l")
      process.exit(0)
    },
  },
  {
    id: "refresh",
    label: "Refresh",
    requires: {},
    execute: () => dispatchAction("refresh"),
  },
  {
    id: "go-namespaces",
    label: "Go to Namespaces",
    shortcut: "N",
    requires: { screen: ["namespaces", "resources"] },
    execute: (ctx) => {
      if (ctx.cluster) navigateTo({ screen: "namespaces", cluster: ctx.cluster })
    },
  },
  {
    id: "add-namespace",
    label: "Add Namespace",
    shortcut: "a",
    requires: { screen: "namespaces" },
    execute: () => dispatchAction("add-namespace"),
  },
  {
    id: "discover-namespaces",
    label: "Discover Namespaces",
    shortcut: "r",
    requires: { screen: "namespaces" },
    execute: () => dispatchAction("discover-namespaces"),
  },
  {
    id: "remove-namespace",
    label: "Remove Namespace",
    requires: { screen: ["namespaces", "resources"] },
    execute: () => dispatchAction("remove-namespace"),
  },
  {
    id: "view-yaml",
    label: "View YAML",
    requires: { screen: "resources", needsSelection: true },
    execute: () => dispatchAction("view-yaml"),
  },
  {
    id: "refresh-capabilities",
    label: "Refresh Capabilities",
    requires: { screen: "resources" },
    execute: () => dispatchAction("refresh-capabilities"),
  },
]

export function buildResourceTypeCommands(types: string[]): Command[] {
  return types.map((type) => ({
    id: `go-${type}`,
    label: `Go to ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    requires: { screen: ["namespaces", "resources"] } as CommandRequires,
    available: (ctx: CommandContext) => {
      if (ctx.canList && !ctx.canList(type)) {
        return { available: false, reason: `no list access to ${type}` }
      }
      return { available: true }
    },
    execute: (ctx: CommandContext) => {
      if (ctx.screen === "resources") {
        dispatchAction(`select-type:${type}`)
      } else if (ctx.cluster && ctx.namespace) {
        navigateTo({ screen: "resources", cluster: ctx.cluster, namespace: ctx.namespace, initialType: type })
      }
    },
  }))
}

export function buildRegistry(resourceTypes: string[]): Command[] {
  return [...BASE_COMMANDS, ...buildResourceTypeCommands(resourceTypes)]
}
