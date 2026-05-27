import { ServerManager } from "./server-manager"
import { resolve } from "node:path"
import { existsSync } from "node:fs"
import { homedir } from "node:os"

const ROOT_DIR = resolve(import.meta.dir, "../../..")
const NATIVE_BINARY = resolve(ROOT_DIR, "knals-server/target/knals-server-0.1.0-SNAPSHOT-runner")
const JVM_JAR = resolve(ROOT_DIR, "knals-server/target/quarkus-app/quarkus-run.jar")
const CONFIG_DIR = process.env.KNALS_CONFIG_DIR ?? resolve(homedir(), ".config/knals")

function resolveServerCommand(): string {
  if (process.env.KNALS_SERVER_CMD) return process.env.KNALS_SERVER_CMD
  if (existsSync(NATIVE_BINARY)) return `${NATIVE_BINARY} -Dquarkus.http.port=__PORT__`
  return `java -Dquarkus.http.port=__PORT__ -jar ${JVM_JAR}`
}

async function main() {
  const serverCmd = resolveServerCommand()
  const isNative = serverCmd.includes("-runner")

  const server = new ServerManager({
    command: serverCmd,
    env: { KNALS_CONFIG_DIR: CONFIG_DIR },
  })

  process.on("SIGINT", async () => {
    await server.stop()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    await server.stop()
    process.exit(0)
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
