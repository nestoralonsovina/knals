import { describe, it, expect, beforeEach } from "bun:test"
import { extractBinary, hashBuffer } from "../src/extract"
import { mkdtempSync, existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, chmodSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("extractBinary", () => {
  let configDir: string
  const fakeData = new TextEncoder().encode("fake-binary-content").buffer

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "knals-extract-"))
  })

  it("extracts binary to bin directory", () => {
    const path = extractBinary(fakeData, configDir)
    expect(existsSync(path)).toBe(true)
    expect(path).toContain("/bin/knals-server-")
  })

  it("binary is executable", () => {
    const path = extractBinary(fakeData, configDir)
    const stat = Bun.file(path)
    expect(existsSync(path)).toBe(true)
  })

  it("skips extraction if hash matches", () => {
    const path1 = extractBinary(fakeData, configDir)
    const path2 = extractBinary(fakeData, configDir)
    expect(path1).toBe(path2)
  })

  it("extracts new binary for different content", () => {
    const path1 = extractBinary(fakeData, configDir)
    const otherData = new TextEncoder().encode("different-content").buffer
    const path2 = extractBinary(otherData, configDir)
    expect(path1).not.toBe(path2)
    expect(existsSync(path2)).toBe(true)
  })

  it("cleans up old binaries on new extraction", () => {
    extractBinary(fakeData, configDir)
    const otherData = new TextEncoder().encode("different-content").buffer
    extractBinary(otherData, configDir)

    const binDir = join(configDir, "bin")
    const files = readdirSync(binDir)
    const serverFiles = files.filter((f) => f.startsWith("knals-server-"))
    expect(serverFiles).toHaveLength(1)
  })

  it("creates nested directories", () => {
    const nested = join(configDir, "deep/nested")
    const path = extractBinary(fakeData, nested)
    expect(existsSync(path)).toBe(true)
  })
})

describe("hashBuffer", () => {
  it("returns consistent hash for same data", () => {
    const data = new TextEncoder().encode("test").buffer
    expect(hashBuffer(data)).toBe(hashBuffer(data))
  })

  it("returns different hash for different data", () => {
    const a = new TextEncoder().encode("a").buffer
    const b = new TextEncoder().encode("b").buffer
    expect(hashBuffer(a)).not.toBe(hashBuffer(b))
  })

  it("returns 12-char hex string", () => {
    const data = new TextEncoder().encode("test").buffer
    const hash = hashBuffer(data)
    expect(hash).toHaveLength(12)
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
  })
})
