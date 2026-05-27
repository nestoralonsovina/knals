import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { startServer, stopServer } from "./harness"
import {
  client,
  getClustersByCtxNamespaces,
  postClustersByCtxNamespaces,
  postClustersByCtxNamespacesDiscover,
} from "@knals/sdk"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

const configDir = mkdtempSync(join(tmpdir(), "knals-e2e-discover-"))

beforeAll(async () => {
  const server = await startServer({
    env: { KNALS_CONFIG_DIR: configDir },
  })
  client.setConfig({ baseUrl: server.url })
}, 120_000)

afterAll(() => {
  stopServer()
})

describe("namespace auto-discovery", () => {
  it("returns empty array when cluster context is unknown", async () => {
    const result = await postClustersByCtxNamespacesDiscover({
      path: { ctx: "nonexistent-cluster" },
    })
    expect(result.response.status).toBe(200)
    expect(result.data).toEqual([])
  }, 30_000)

  it("preserves manually-added namespaces after failed discovery", async () => {
    const ctx = "preserve-test"
    await postClustersByCtxNamespaces({
      path: { ctx },
      body: { name: "manual-ns" },
    })

    await postClustersByCtxNamespacesDiscover({
      path: { ctx },
    })

    const list = await getClustersByCtxNamespaces({ path: { ctx } })
    expect(list.data).toContain("manual-ns")
  }, 30_000)

  it("discover is idempotent on empty result", async () => {
    const ctx = "idempotent-test"
    const first = await postClustersByCtxNamespacesDiscover({
      path: { ctx },
    })
    const second = await postClustersByCtxNamespacesDiscover({
      path: { ctx },
    })
    expect(first.data).toEqual([])
    expect(second.data).toEqual([])
  }, 60_000)
})
