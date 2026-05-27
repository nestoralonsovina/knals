import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { startServer, stopServer, getServerUrl } from "./harness"
import {
  client,
  getClustersByCtxNamespaces,
  postClustersByCtxNamespaces,
  deleteClustersByCtxNamespacesByNs,
} from "@knals/sdk"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

const configDir = mkdtempSync(join(tmpdir(), "knals-e2e-ns-"))

beforeAll(async () => {
  const server = await startServer({
    env: { KNALS_CONFIG_DIR: configDir },
  })
  client.setConfig({ baseUrl: server.url })
}, 120_000)

afterAll(() => {
  stopServer()
})

describe("namespace memory CRUD", () => {
  const ctx = "test-ctx"

  it("GET returns empty array for new cluster", async () => {
    const result = await getClustersByCtxNamespaces({ path: { ctx } })
    expect(result.data).toEqual([])
  })

  it("POST adds a namespace", async () => {
    const result = await postClustersByCtxNamespaces({
      path: { ctx },
      body: { name: "team-api" },
    })
    expect(result.response.status).toBe(201)
  })

  it("GET returns added namespace", async () => {
    const result = await getClustersByCtxNamespaces({ path: { ctx } })
    expect(result.data).toEqual(["team-api"])
  })

  it("POST adds a second namespace", async () => {
    const result = await postClustersByCtxNamespaces({
      path: { ctx },
      body: { name: "team-billing" },
    })
    expect(result.response.status).toBe(201)
  })

  it("GET returns both namespaces", async () => {
    const result = await getClustersByCtxNamespaces({ path: { ctx } })
    expect(result.data).toHaveLength(2)
    expect(result.data).toContain("team-api")
    expect(result.data).toContain("team-billing")
  })

  it("POST is idempotent", async () => {
    const result = await postClustersByCtxNamespaces({
      path: { ctx },
      body: { name: "team-api" },
    })
    expect(result.response.status).toBe(201)

    const list = await getClustersByCtxNamespaces({ path: { ctx } })
    expect(list.data).toHaveLength(2)
  })

  it("POST rejects blank name", async () => {
    const result = await postClustersByCtxNamespaces({
      path: { ctx },
      body: { name: "" },
    })
    expect(result.response.status).toBe(400)
  })

  it("POST rejects missing name", async () => {
    const result = await postClustersByCtxNamespaces({
      path: { ctx },
      body: {} as any,
    })
    expect(result.response.status).toBe(400)
  })

  it("DELETE removes a namespace", async () => {
    const result = await deleteClustersByCtxNamespacesByNs({
      path: { ctx, ns: "team-api" },
    })
    expect(result.response.status).toBe(204)

    const list = await getClustersByCtxNamespaces({ path: { ctx } })
    expect(list.data).toEqual(["team-billing"])
  })

  it("DELETE returns 404 for nonexistent namespace", async () => {
    const result = await deleteClustersByCtxNamespacesByNs({
      path: { ctx, ns: "nonexistent" },
    })
    expect(result.response.status).toBe(404)
  })

  it("namespaces are isolated between clusters", async () => {
    await postClustersByCtxNamespaces({
      path: { ctx: "other-cluster" },
      body: { name: "ns-other" },
    })

    const list1 = await getClustersByCtxNamespaces({ path: { ctx } })
    expect(list1.data).toEqual(["team-billing"])

    const list2 = await getClustersByCtxNamespaces({ path: { ctx: "other-cluster" } })
    expect(list2.data).toEqual(["ns-other"])
  })
})

describe("namespace memory persistence", () => {
  it("survives server restart", async () => {
    const ctx = "persist-test"
    await postClustersByCtxNamespaces({
      path: { ctx },
      body: { name: "persistent-ns" },
    })

    stopServer()

    const server = await startServer({
      env: { KNALS_CONFIG_DIR: configDir },
    })
    client.setConfig({ baseUrl: server.url })

    const result = await getClustersByCtxNamespaces({ path: { ctx } })
    expect(result.data).toEqual(["persistent-ns"])
  }, 120_000)
})
