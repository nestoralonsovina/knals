import { describe, it, expect, afterEach } from "bun:test"
import { ServerManager } from "../src/server-manager"
import { resolve } from "node:path"
import { client, getClusters, getClustersByCtxNamespaces } from "@knals/sdk"

const ROOT_DIR = resolve(import.meta.dir, "../../..")
const SERVER_JAR = resolve(ROOT_DIR, "knals-server/target/quarkus-app/quarkus-run.jar")

describe("launcher integration", () => {
  let manager: ServerManager

  afterEach(async () => {
    if (manager) await manager.stop()
  })

  it("starts server, SDK can query it, then stops cleanly", async () => {
    const configDir = `${Bun.env.TMPDIR}/knals-launcher-test-${Date.now()}`
    manager = new ServerManager({
      command: `java -Dquarkus.http.port=__PORT__ -jar ${SERVER_JAR}`,
      env: { KNALS_CONFIG_DIR: configDir },
    })

    const { url } = await manager.start()
    client.setConfig({ baseUrl: url })

    const clusters = await getClusters()
    expect(clusters.data).toBeDefined()
    expect(Array.isArray(clusters.data)).toBe(true)

    const namespaces = await getClustersByCtxNamespaces({
      path: { ctx: "nonexistent" },
    })
    expect(namespaces.data).toEqual([])

    await manager.stop()
    expect(manager.isRunning()).toBe(false)
  }, 60_000)
})
