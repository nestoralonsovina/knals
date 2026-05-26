import { resolve } from "node:path"

const ROOT_DIR = resolve(import.meta.dir, "../../..")
const DEFAULT_CMD = `java -Dquarkus.http.port=__PORT__ -jar ${resolve(ROOT_DIR, "knals-server/target/quarkus-app/quarkus-run.jar")}`

let serverProc: ReturnType<typeof Bun.spawn> | null = null
let serverPort: number | null = null

function findFreePort(): number {
  return 10000 + Math.floor(Math.random() * 50000)
}

export async function startServer(opts?: {
  port?: number
  env?: Record<string, string>
}): Promise<{ port: number; url: string }> {
  const port = opts?.port ?? findFreePort()
  const cmdTemplate = process.env.KNALS_SERVER_CMD ?? DEFAULT_CMD
  const cmd = cmdTemplate.replace(/__PORT__/g, String(port))
  const parts = cmd.split(/\s+/)

  serverProc = Bun.spawn(parts, {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...opts?.env },
  })
  serverPort = port

  const url = `http://localhost:${port}`

  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const resp = await fetch(`${url}/q/health/ready`)
      if (resp.ok) return { port, url }
    } catch {
      // not ready yet
    }

    if (serverProc.exitCode !== null) {
      const stderr = await new Response(serverProc.stderr).text()
      throw new Error(`Server exited with ${serverProc.exitCode}:\n${stderr}`)
    }

    await Bun.sleep(1000)
  }

  stopServer()
  throw new Error("Server did not start within 60s")
}

export function stopServer(): void {
  if (serverProc) {
    serverProc.kill()
    serverProc = null
    serverPort = null
  }
}

export function getServerUrl(): string {
  if (!serverPort) throw new Error("Server not started")
  return `http://localhost:${serverPort}`
}
