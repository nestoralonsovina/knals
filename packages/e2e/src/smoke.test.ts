import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { startServer, stopServer, getServerUrl } from "./harness"
import { client, getClusters } from "@knals/sdk"

let serverUrl: string

beforeAll(async () => {
  const server = await startServer()
  serverUrl = server.url
  client.setConfig({ baseUrl: serverUrl })
}, 120_000)

afterAll(() => {
  stopServer()
})

describe("smoke test", () => {
  it("server health endpoint responds OK", async () => {
    const resp = await fetch(`${serverUrl}/q/health/ready`)
    expect(resp.ok).toBe(true)
  })

  it("GET /clusters returns an array via SDK", async () => {
    const result = await getClusters()
    expect(result.data).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
  })

  it("cluster objects have the expected shape", async () => {
    const result = await getClusters()
    const clusters = result.data!
    for (const cluster of clusters) {
      expect(typeof cluster.name).toBe("string")
      expect(typeof cluster.server).toBe("string")
      expect(typeof cluster.connected).toBe("boolean")
    }
  })
})
