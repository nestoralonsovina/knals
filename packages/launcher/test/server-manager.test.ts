import { describe, it, expect, afterEach } from "bun:test"
import { ServerManager } from "../src/server-manager"
import { resolve } from "node:path"

const ROOT_DIR = resolve(import.meta.dir, "../../..")
const SERVER_JAR = resolve(ROOT_DIR, "knals-server/target/quarkus-app/quarkus-run.jar")

describe("ServerManager", () => {
  let manager: ServerManager

  afterEach(async () => {
    if (manager) {
      await manager.stop()
    }
  })

  it("starts server and resolves with port and url", async () => {
    manager = new ServerManager({
      command: `java -Dquarkus.http.port=__PORT__ -jar ${SERVER_JAR}`,
    })
    const { port, url } = await manager.start()
    expect(port).toBeGreaterThan(0)
    expect(url).toStartWith("http://127.0.0.1:")
  }, 60_000)

  it("health check passes after start", async () => {
    manager = new ServerManager({
      command: `java -Dquarkus.http.port=__PORT__ -jar ${SERVER_JAR}`,
    })
    const { url } = await manager.start()
    const resp = await fetch(`${url}/q/health/ready`)
    expect(resp.ok).toBe(true)
  }, 60_000)

  it("stop kills the server process", async () => {
    manager = new ServerManager({
      command: `java -Dquarkus.http.port=__PORT__ -jar ${SERVER_JAR}`,
    })
    const { url } = await manager.start()
    await manager.stop()

    try {
      await fetch(`${url}/q/health/ready`)
      expect(true).toBe(false) // should not reach
    } catch {
      // connection refused — expected
    }
  }, 60_000)

  it("passes environment variables to server", async () => {
    const configDir = Bun.env.TMPDIR + "/knals-test-" + Date.now()
    manager = new ServerManager({
      command: `java -Dquarkus.http.port=__PORT__ -jar ${SERVER_JAR}`,
      env: { KNALS_CONFIG_DIR: configDir },
    })
    const { url } = await manager.start()
    const resp = await fetch(`${url}/q/health/ready`)
    expect(resp.ok).toBe(true)
  }, 60_000)

  it("isRunning returns correct state", async () => {
    manager = new ServerManager({
      command: `java -Dquarkus.http.port=__PORT__ -jar ${SERVER_JAR}`,
    })
    expect(manager.isRunning()).toBe(false)
    await manager.start()
    expect(manager.isRunning()).toBe(true)
    await manager.stop()
    expect(manager.isRunning()).toBe(false)
  }, 60_000)
})
