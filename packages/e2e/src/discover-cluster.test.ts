import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { isClusterRunning, clusterUp, kubeconfigPath } from "./cluster"
import { startServer, stopServer, getServerUrl } from "./harness"
import {
  client,
  getClusters,
  getClustersByCtxNamespaces,
  postClustersByCtxNamespaces,
  postClustersByCtxNamespacesDiscover,
} from "@knals/sdk"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("namespace discovery with full-access persona", () => {
  let clusterCtx: string
  const configDir = mkdtempSync(join(tmpdir(), "knals-e2e-discover-cluster-"))

  beforeAll(async () => {
    if (!isClusterRunning()) await clusterUp()

    const kubeconfig = kubeconfigPath("full-access")
    const server = await startServer({
      env: { KUBECONFIG: kubeconfig, KNALS_CONFIG_DIR: configDir },
    })
    client.setConfig({ baseUrl: server.url })

    const clusters = await getClusters()
    clusterCtx = clusters.data!.find((c) => c.name?.includes("knals-test"))!.name!
  }, 300_000)

  afterAll(() => {
    stopServer()
  })

  it("discovers test namespaces from the cluster", async () => {
    const result = await postClustersByCtxNamespacesDiscover({
      path: { ctx: clusterCtx },
    })
    expect(result.response.status).toBe(200)
    const discovered = result.data as string[]
    expect(discovered.length).toBeGreaterThan(0)
    expect(discovered).toContain("team-api")
    expect(discovered).toContain("team-billing")
    expect(discovered).toContain("team-infra")
  })

  it("discovered namespaces are persisted in memory", async () => {
    const result = await getClustersByCtxNamespaces({ path: { ctx: clusterCtx } })
    const stored = result.data as string[]
    expect(stored).toContain("team-api")
    expect(stored).toContain("team-billing")
    expect(stored).toContain("team-infra")
  })

  it("second discover returns empty (already known)", async () => {
    const result = await postClustersByCtxNamespacesDiscover({
      path: { ctx: clusterCtx },
    })
    const discovered = result.data as string[]
    expect(discovered).toEqual([])
  })
})

describe("namespace discovery with namespace-only persona", () => {
  let clusterCtx: string
  const configDir = mkdtempSync(join(tmpdir(), "knals-e2e-discover-nsonly-"))

  beforeAll(async () => {
    if (!isClusterRunning()) await clusterUp()

    const kubeconfig = kubeconfigPath("namespace-only")
    const server = await startServer({
      env: { KUBECONFIG: kubeconfig, KNALS_CONFIG_DIR: configDir },
    })
    client.setConfig({ baseUrl: server.url })

    const clusters = await getClusters()
    clusterCtx = clusters.data!.find((c) => c.name?.includes("knals-test"))!.name!
  }, 300_000)

  afterAll(() => {
    stopServer()
  })

  it("discover returns empty — persona cannot LIST namespaces", async () => {
    const result = await postClustersByCtxNamespacesDiscover({
      path: { ctx: clusterCtx },
    })
    expect(result.response.status).toBe(200)
    const discovered = result.data as string[]
    expect(discovered).toEqual([])
  })

  it("manual add still works for accessible namespace", async () => {
    const result = await postClustersByCtxNamespaces({
      path: { ctx: clusterCtx },
      body: { name: "team-api" },
    })
    expect(result.response.status).toBe(201)

    const list = await getClustersByCtxNamespaces({ path: { ctx: clusterCtx } })
    expect(list.data).toContain("team-api")
  })
})
