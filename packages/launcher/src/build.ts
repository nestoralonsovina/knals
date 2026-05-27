import { resolve, basename } from "node:path"
import { existsSync, mkdirSync, readFileSync, copyFileSync, readdirSync } from "node:fs"
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const ROOT_DIR = resolve(import.meta.dir, "../../..")
const ENTRY = resolve(import.meta.dir, "index.ts")
const OUT_DIR = resolve(ROOT_DIR, "dist")
const BUNDLE_PATH = resolve(OUT_DIR, "index.js")
const BINARY_PATH = resolve(OUT_DIR, "knals")

function findNativeBinary(): string {
  const targetDir = resolve(ROOT_DIR, "knals-server/target")
  if (!existsSync(targetDir)) return ""
  const match = readdirSync(targetDir).find(f => f.startsWith("knals-server-") && f.endsWith("-runner"))
  return match ? resolve(targetDir, match) : ""
}

const NATIVE_BINARY = findNativeBinary()

mkdirSync(OUT_DIR, { recursive: true })

console.log(`Building knals binary for ${process.platform}-${process.arch}...`)

if (!NATIVE_BINARY) {
  console.error("Native server binary not found in knals-server/target/")
  console.error("Run 'make native' first to build it.")
  process.exit(1)
}

const nativePkg = `@opentui/core-${process.platform}-${process.arch}`

console.log("Step 1/2: Bundling with Solid transform...")
const bundleResult = await Bun.build({
  entrypoints: [ENTRY],
  outdir: OUT_DIR,
  target: "bun",
  minify: true,
  plugins: [createSolidTransformPlugin()],
  external: [nativePkg],
})

if (!bundleResult.success) {
  console.error("Bundle failed:")
  for (const log of bundleResult.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.log("Step 2/2: Compiling to standalone binary...")
const compileProc = Bun.spawn(
  ["bun", "build", "--compile", BUNDLE_PATH, "--outfile", BINARY_PATH,
   "--external", nativePkg],
  { stdout: "inherit", stderr: "inherit" }
)
const compileExit = await compileProc.exited
if (compileExit !== 0) {
  console.error("Compile failed")
  process.exit(1)
}

// Create a minimal node_modules structure for the native module
const nativePkgSrc = resolve(ROOT_DIR, `node_modules/.bun/${nativePkg.replace("/", "+")}@0.2.15/node_modules/${nativePkg}`)
const nativePkgDest = resolve(OUT_DIR, "node_modules", nativePkg)
if (existsSync(nativePkgSrc)) {
  mkdirSync(nativePkgDest, { recursive: true })
  for (const file of ["index.js", "package.json", "libopentui.dylib"]) {
    const src = resolve(nativePkgSrc, file)
    if (existsSync(src)) copyFileSync(src, resolve(nativePkgDest, file))
  }
  console.log(`  Installed ${nativePkg}`)
}

// Copy the server binary
const serverDest = resolve(OUT_DIR, "knals-server")
copyFileSync(NATIVE_BINARY, serverDest)

const binarySize = readFileSync(BINARY_PATH).length
const serverSize = readFileSync(serverDest).length
console.log(`\nBuild complete:`)
console.log(`  dist/knals        (${(binarySize / 1024 / 1024).toFixed(1)}MB) — launcher + TUI`)
console.log(`  dist/knals-server (${(serverSize / 1024 / 1024).toFixed(0)}MB) — native server`)
console.log(`\nRun with: ./dist/knals`)
