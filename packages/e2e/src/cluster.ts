import { resolve } from "node:path"
import { existsSync } from "node:fs"

const ROOT_DIR = resolve(import.meta.dir, "../../..")
const TEST_DIR = resolve(ROOT_DIR, "test")
const KUBECONFIGS_DIR = resolve(TEST_DIR, "kubeconfigs")

async function exec(cmd: string[], opts?: { inheritStderr?: boolean }): Promise<string> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: opts?.inheritStderr ? "inherit" : "pipe",
    cwd: TEST_DIR,
  })
  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} exited with ${exitCode}`)
  }
  return stdout.trim()
}

export async function clusterUp(): Promise<void> {
  await exec(["bun", "run", "cluster:up"], { inheritStderr: true })
}

export async function clusterDown(): Promise<void> {
  await exec(["bun", "run", "cluster:down"], { inheritStderr: true })
}

export function isClusterRunning(): boolean {
  return existsSync(resolve(KUBECONFIGS_DIR, "full-access.yaml"))
}

export function kubeconfigPath(persona: string): string {
  const path = resolve(KUBECONFIGS_DIR, `${persona}.yaml`)
  if (!existsSync(path)) {
    throw new Error(`Kubeconfig not found: ${path}. Run clusterUp() first.`)
  }
  return path
}
