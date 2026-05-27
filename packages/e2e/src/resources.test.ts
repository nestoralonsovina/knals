import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { startServer, stopServer, getServerUrl } from "./harness"
import { client } from "@knals/sdk"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

const configDir = mkdtempSync(join(tmpdir(), "knals-e2e-resources-"))

beforeAll(async () => {
  const server = await startServer({
    env: { KNALS_CONFIG_DIR: configDir },
  })
  client.setConfig({ baseUrl: server.url })
}, 120_000)

afterAll(() => {
  stopServer()
})

describe("resource list endpoint", () => {
  it("returns 400 for unknown resource type", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/test-ctx/namespaces/default/resources/unknown`
    )
    expect(resp.status).toBe(400)
  })

  it("returns 200 with table shape for pods", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/test-ctx/namespaces/default/resources/pods`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("pods")
    expect(Array.isArray(data.columns)).toBe(true)
    expect(Array.isArray(data.items)).toBe(true)
  }, 30_000)

  it("returns 200 with table shape for deployments", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/test-ctx/namespaces/default/resources/deployments`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("deployments")
    expect(Array.isArray(data.items)).toBe(true)
  }, 30_000)

  it("returns 200 with table shape for services", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/test-ctx/namespaces/default/resources/services`
    )
    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.kind).toBe("services")
  }, 30_000)
})

describe("resource detail endpoint", () => {
  it("returns 400 for unknown resource type", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/test-ctx/namespaces/default/resources/unknown/my-resource`
    )
    expect(resp.status).toBe(400)
  })

  it("returns 404 for nonexistent resource in unreachable cluster", async () => {
    const resp = await fetch(
      `${getServerUrl()}/clusters/test-ctx/namespaces/default/resources/pods/nonexistent-pod`
    )
    expect(resp.status).toBe(404)
  }, 30_000)
})
