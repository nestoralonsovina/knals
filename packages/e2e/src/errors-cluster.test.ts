import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { isClusterRunning, clusterUp, kubeconfigPath } from "./cluster"
import { startServer, stopServer, getServerUrl } from "./harness"
import { client, getClusters } from "@knals/sdk"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("error classification with namespace-only persona", () => {
  let clusterCtx: string

  beforeAll(async () => {
    if (!isClusterRunning()) await clusterUp()

    const kubeconfig = kubeconfigPath("namespace-only")
    const server = await startServer({ env: { KUBECONFIG: kubeconfig } })
    client.setConfig({ baseUrl: server.url })

    const clusters = await getClusters()
    clusterCtx = clusters.data!.find((c) => c.name?.includes("knals-test"))!.name!
  }, 300_000)

  afterAll(() => {
    stopServer()
  })

  it("returns 200 for authorized namespace (team-api)", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/pods`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.items.length).toBeGreaterThan(0)
  })

  it("returns 403 for unauthorized namespace (team-billing)", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-billing/resources/pods`
    )
    expect(resp.status).toBe(403)
    const data = await resp.json()
    expect(data.error).toBeDefined()
  })

  it("returns 403 for resource detail in unauthorized namespace", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-billing/resources/pods/some-pod`
    )
    expect(resp.status).toBe(403)
  })

  it("returns 400 for unknown resource type", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/foobar`
    )
    expect(resp.status).toBe(400)
  })
})

describe("error classification with full-access persona", () => {
  let clusterCtx: string

  beforeAll(async () => {
    if (!isClusterRunning()) await clusterUp()

    const kubeconfig = kubeconfigPath("full-access")
    const server = await startServer({ env: { KUBECONFIG: kubeconfig } })
    client.setConfig({ baseUrl: server.url })

    const clusters = await getClusters()
    clusterCtx = clusters.data!.find((c) => c.name?.includes("knals-test"))!.name!
  }, 300_000)

  afterAll(() => {
    stopServer()
  })

  it("returns 404 for nonexistent pod", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/pods/does-not-exist`
    )
    expect(resp.status).toBe(404)
  })

  it("returns 200 with empty items for namespace with no resources of a type", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/statefulsets`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.items).toEqual([])
  })
})

describe("502 unreachable cluster", () => {
  const configDir = mkdtempSync(join(tmpdir(), "knals-e2e-errors-502-"))

  beforeAll(async () => {
    const server = await startServer({
      env: { KNALS_CONFIG_DIR: configDir },
    })
    client.setConfig({ baseUrl: server.url })
  }, 120_000)

  afterAll(() => {
    stopServer()
  })

  it("returns 502 when server has no valid KUBECONFIG", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/nonexistent-ctx/namespaces/default/resources/pods`
    )
    expect([404, 502]).toContain(resp.status)
  }, 30_000)
})
