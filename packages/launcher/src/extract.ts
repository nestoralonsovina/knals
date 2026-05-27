import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, chmodSync } from "node:fs"
import { join, basename } from "node:path"
import { createHash } from "node:crypto"

export function extractBinary(
  embeddedData: ArrayBuffer,
  configDir: string,
): string {
  const binDir = join(configDir, "bin")
  mkdirSync(binDir, { recursive: true })

  const hash = createHash("sha256").update(Buffer.from(embeddedData)).digest("hex").slice(0, 12)
  const binaryName = `knals-server-${hash}`
  const binaryPath = join(binDir, binaryName)

  if (existsSync(binaryPath)) {
    return binaryPath
  }

  cleanOldBinaries(binDir, binaryName)
  writeFileSync(binaryPath, Buffer.from(embeddedData))
  chmodSync(binaryPath, 0o755)
  return binaryPath
}

function cleanOldBinaries(binDir: string, currentName: string): void {
  try {
    for (const entry of readdirSync(binDir)) {
      if (entry.startsWith("knals-server-") && entry !== currentName) {
        unlinkSync(join(binDir, entry))
      }
    }
  } catch {
    // best effort cleanup
  }
}

export function hashBuffer(data: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(data)).digest("hex").slice(0, 12)
}
