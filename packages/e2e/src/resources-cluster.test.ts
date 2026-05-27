import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { isClusterRunning, clusterUp, kubeconfigPath } from "./cluster"
import { startServer, stopServer, getServerUrl } from "./harness"
import { client, getClusters } from "@knals/sdk"

let clusterCtx: string

beforeAll(async () => {
  if (!isClusterRunning()) await clusterUp()

  const kubeconfig = kubeconfigPath("full-access")
  const server = await startServer({ env: { KUBECONFIG: kubeconfig } })
  client.setConfig({ baseUrl: server.url })

  const clusters = await getClusters()
  const knals = clusters.data!.find((c) => c.name?.includes("knals-test"))
  clusterCtx = knals!.name!
}, 300_000)

afterAll(() => {
  stopServer()
})

describe("resource types endpoint", () => {
  it("returns catalog of 14 resource types", async () => {
    const resp = await fetch(`${getServerUrl()}/resources/types`)
    expect(resp.status).toBe(200)
    const types = await resp.json()
    expect(Array.isArray(types)).toBe(true)
    expect(types.length).toBe(14)
    for (const t of types) {
      expect(t.name).toBeDefined()
      expect(t.plural).toBeDefined()
      expect(t.apiPath).toBeDefined()
    }
    const names = types.map((t: any) => t.name)
    expect(names).toContain("pods")
    expect(names).toContain("deployments")
    expect(names).toContain("services")
    expect(names).toContain("ingresses")
  })
})

describe("resource list with full-access persona", () => {
  it("lists pods in team-api with correct shape", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/pods`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("pods")
    expect(data.columns.length).toBeGreaterThan(0)
    expect(data.columns).toContain("Name")
    expect(data.items.length).toBeGreaterThan(0)

    const names = data.items.map((i: any) => i.name)
    expect(names).toContain("cache-warmer")

    for (const item of data.items) {
      expect(item.name).toBeTruthy()
      expect(item.namespace).toBe("team-api")
      expect(Array.isArray(item.cells)).toBe(true)
      expect(item.cells.length).toBeGreaterThan(0)
      expect(item.creationTimestamp).toBeTruthy()
    }
  })

  it("lists deployments in team-api", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/deployments`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("deployments")
    const names = data.items.map((i: any) => i.name)
    expect(names).toContain("gateway")
    expect(names).toContain("user-service")
  })

  it("lists services in team-api", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/services`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("services")
    const names = data.items.map((i: any) => i.name)
    expect(names).toContain("gateway")
    expect(names).toContain("user-service")
  })

  it("lists jobs in team-api", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/jobs`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("jobs")
    const names = data.items.map((i: any) => i.name)
    expect(names).toContain("db-migrate")
  })

  it("lists cronjobs in team-api", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/cronjobs`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("cronjobs")
    const names = data.items.map((i: any) => i.name)
    expect(names).toContain("report-generator")
  })

  it("lists configmaps in team-api", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/configmaps`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("configmaps")
    const names = data.items.map((i: any) => i.name)
    expect(names).toContain("api-config")
  })

  it("lists secrets in team-api", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/secrets`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("secrets")
    const names = data.items.map((i: any) => i.name)
    expect(names).toContain("api-credentials")
  })

  it("lists ingresses in team-api", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/ingresses`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("ingresses")
    const names = data.items.map((i: any) => i.name)
    expect(names).toContain("api-ingress")
  })
})

describe("resource detail with full-access persona", () => {
  it("returns full pod JSON for a known pod", async () => {
    const listResp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/pods`
    )
    const listData = await listResp.json()
    const podName = listData.items.find((i: any) => i.name === "cache-warmer")?.name
    expect(podName).toBeDefined()

    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/pods/${podName}`
    )
    expect(resp.status).toBe(200)
    const pod = await resp.json()
    expect(pod.apiVersion).toBe("v1")
    expect(pod.kind).toBe("Pod")
    expect(pod.metadata.name).toBe("cache-warmer")
    expect(pod.metadata.namespace).toBe("team-api")
  })

  it("returns 404 for nonexistent pod", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${clusterCtx}/namespaces/team-api/resources/pods/does-not-exist`
    )
    expect(resp.status).toBe(404)
  })
})

describe("resource list with namespace-only persona", () => {
  let nsOnlyCtx: string

  beforeAll(async () => {
    const kubeconfig = kubeconfigPath("namespace-only")
    const server = await startServer({ env: { KUBECONFIG: kubeconfig } })
    client.setConfig({ baseUrl: server.url })

    const clusters = await getClusters()
    nsOnlyCtx = clusters.data!.find((c) => c.name?.includes("knals-test"))!.name!
  }, 300_000)

  afterAll(() => {
    stopServer()
  })

  it("returns 200 with real data in authorized namespace (team-api)", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${nsOnlyCtx}/namespaces/team-api/resources/pods`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.items.length).toBeGreaterThan(0)
  })

  it("returns 403 for unauthorized namespace (team-billing)", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/${nsOnlyCtx}/namespaces/team-billing/resources/pods`
    )
    expect(resp.status).toBe(403)
  })
})
