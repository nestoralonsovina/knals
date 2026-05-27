import { describe, it, expect } from "bun:test"
import { shortName, hashSuffix, truncate, listBadge, computeDetailWidth, computeListWidth } from "./resource-layout"

describe("shortName", () => {
  it("strips replicaset + pod hash (deployment pod)", () => {
    expect(shortName("gateway-7b4f8d6c9a-x2k5m")).toBe("gateway")
  })

  it("strips replicaset hash only", () => {
    expect(shortName("gateway-7b4f8d6c9a")).toBe("gateway")
  })

  it("returns full name when no hash pattern", () => {
    expect(shortName("cache-warmer")).toBe("cache-warmer")
  })

  it("handles names with hyphens in the base", () => {
    expect(shortName("user-service-abc1234567-z9x8y")).toBe("user-service")
  })
})

describe("hashSuffix", () => {
  it("returns hash portion for deployment pod", () => {
    expect(hashSuffix("gateway-7b4f8d6c9a-x2k5m")).toBe("-7b4f8d6c9a-x2k5m")
  })

  it("returns empty for names without hash", () => {
    expect(hashSuffix("cache-warmer")).toBe("")
  })
})

describe("truncate", () => {
  it("returns full string when within max", () => {
    expect(truncate("hello", 10)).toBe("hello")
  })

  it("truncates with ellipsis when too long", () => {
    expect(truncate("hello world", 8)).toBe("hello w…")
  })

  it("returns empty for max < 1", () => {
    expect(truncate("hello", 0)).toBe("")
  })

  it("handles exact max length", () => {
    expect(truncate("hello", 5)).toBe("hello")
  })
})

describe("listBadge", () => {
  it("returns third cell when available", () => {
    expect(listBadge(["pod-1", "1/1", "Running", "0", "3d"])).toBe("Running")
  })

  it("returns empty when fewer than 3 cells", () => {
    expect(listBadge(["a", "b"])).toBe("")
  })
})

describe("computeDetailWidth", () => {
  it("computes 48% of remaining width", () => {
    expect(computeDetailWidth(120, 20)).toBe(48)
  })

  it("enforces minimum of 36", () => {
    expect(computeDetailWidth(60, 20)).toBe(36)
  })
})

describe("computeListWidth", () => {
  it("uses full remaining width when detail closed", () => {
    expect(computeListWidth(120, 20, 0, false)).toBe(96)
  })

  it("subtracts detail width when open", () => {
    expect(computeListWidth(120, 20, 48, true)).toBe(48)
  })
})
