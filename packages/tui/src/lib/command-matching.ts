import { isAvailable, type Command, type CommandRequires } from "./commands"
import type { CommandContext } from "./command-context"

export interface MatchResult {
  command: Command
  available: boolean
  reason?: string
}

export function matchCommands(
  query: string,
  commands: Command[],
  ctx: CommandContext,
  showAll: boolean,
): MatchResult[] {
  const results: MatchResult[] = []

  for (const cmd of commands) {
    const { available, reason } = isAvailable(cmd, ctx)
    if (!available && !showAll) continue

    if (!query) {
      results.push({ command: cmd, available, reason })
      continue
    }

    if (matches(query, cmd.label)) {
      results.push({ command: cmd, available, reason })
    }
  }

  if (query) {
    results.sort((a, b) => rank(query, a.command.label) - rank(query, b.command.label))
  }

  return results
}

function matches(query: string, label: string): boolean {
  return label.toLowerCase().includes(query.toLowerCase())
}

function rank(query: string, label: string): number {
  const q = query.toLowerCase()
  const l = label.toLowerCase()
  if (l === q) return 0
  const words = l.split(/\s+/)
  for (const word of words) {
    if (word.startsWith(q)) return 1
  }
  if (l.startsWith(q)) return 2
  return 3
}
