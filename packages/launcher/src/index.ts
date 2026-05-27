import { ServerManager } from "./server-manager"
import { resolve, dirname } from "node:path"
import { existsSync } from "node:fs"
import { homedir } from "node:os"

const SELF_DIR = dirname(process.execPath)
const ROOT_DIR = resolve(import.meta.dir, "../../..")
const CONFIG_DIR = process.env.KNALS_CONFIG_DIR ?? resolve(homedir(), ".config/knals")

// Compiled binaries need NODE_PATH set before module resolution initializes.
// Re-exec with NODE_PATH if we detect dist/node_modules alongside the binary.
const distNodeModules = resolve(SELF_DIR, "node_modules")
if (existsSync(distNodeModules) && !process.env.__KNALS_INIT) {
  const child = Bun.spawn([process.execPath, ...process.argv.slice(2)], {
    env: {
      ...process.env,
      NODE_PATH: distNodeModules + (process.env.NODE_PATH ? `:${process.env.NODE_PATH}` : ""),
      __KNALS_INIT: "1",
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  process.exit(await child.exited)
}

function resolveServerCommand(): string {
  if (process.env.KNALS_SERVER_CMD) return process.env.KNALS_SERVER_CMD

  const distBinary = resolve(SELF_DIR, "knals-server")
  if (existsSync(distBinary)) return `${distBinary} -Dquarkus.http.port=__PORT__`

  const jvmJar = resolve(ROOT_DIR, "knals-server/target/quarkus-app/quarkus-run.jar")
  return `java -Dquarkus.http.port=__PORT__ -jar ${jvmJar}`
}

function resetTerminal() {
  process.stdout.write("\x1b[?1049l\x1b[?25h\x1b[0m\x1b[?1003l\x1b[?1002l\x1b[?1000l\x1b[?1006l\x1b[?2004l")
}

async function main() {
  const serverCmd = resolveServerCommand()
  const isNative = !serverCmd.includes("java ")

  const server = new ServerManager({
    command: serverCmd,
    env: { KNALS_CONFIG_DIR: CONFIG_DIR },
  })

  process.on("SIGINT", async () => {
    resetTerminal()
    await server.stop()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    resetTerminal()
    await server.stop()
    process.exit(0)
  })

  process.on("exit", () => {
    resetTerminal()
  })

  try {
    console.log(`Starting knals server (${isNative ? "native" : "JVM"})...`)
    const { url } = await server.start()
    console.log(`Server ready at ${url}`)

    server.onExit((code) => {
      console.error(`Server crashed with exit code ${code}`)
      process.exit(1)
    })

    process.env.KNALS_SERVER_URL = url

    const tui = await import("@knals/tui")
  } catch (err: any) {
    console.error(`Failed to start: ${err.message}`)
    await server.stop()
    process.exit(1)
  }
}

main()
