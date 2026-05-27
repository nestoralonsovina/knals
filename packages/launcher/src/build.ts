import { resolve } from "node:path"

const ROOT_DIR = resolve(import.meta.dir, "../../..")
const ENTRY = resolve(import.meta.dir, "index.ts")
const OUT_DIR = resolve(ROOT_DIR, "dist")

const target = `bun-${process.platform}-${process.arch}` as const

console.log(`Building knals binary for ${target}...`)

const result = await Bun.build({
  entrypoints: [ENTRY],
  outdir: OUT_DIR,
  target: "bun",
  minify: true,
})

if (!result.success) {
  console.error("Build failed:")
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.log(`Built to ${OUT_DIR}/`)
