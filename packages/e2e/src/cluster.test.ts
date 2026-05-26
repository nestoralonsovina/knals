import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { clusterUp, clusterDown, isClusterRunning, kubeconfigPath } from "./cluster"
import { startServer, stopServer, getServerUrl } from "./harness"
import { client, getClusters } from "@knals/sdk"

beforeAll(async () => {
  if (!isClusterRunning()) {
    await clusterUp()
  }

  const kubeconfig = kubeconfigPath("namespace-only")
  const server = await startServer({
    env: { KUBECONFIG: kubeconfig },
  })
  client.setConfig({ baseUrl: server.url })
}, 300_000)

afterAll(async () => {
  stopServer()
  await clusterDown()
})

describe("cluster integration with namespace-only persona", () => {
  it("server starts with restricted kubeconfig", () => {
    expect(getServerUrl()).toContain("http://localhost:")
  })

  it("GET /clusters returns an array via SDK", async () => {
    const result = await getClusters()
    expect(result.data).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
  })

  it("knals-test cluster context is present", async () => {
    const result = await getClusters()
    const clusters = result.data!
    const knalsCluster = clusters.find((c) => c.name?.includes("knals-test"))
    expect(knalsCluster).toBeDefined()
    expect(knalsCluster!.server).toContain("https://")
  })

  it("server is operational despite restricted RBAC", async () => {
    const resp = await fetch(`${getServerUrl()}/q/health/ready`)
    expect(resp.ok).toBe(true)
  })
})
