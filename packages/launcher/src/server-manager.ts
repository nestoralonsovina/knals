export interface ServerManagerOptions {
  command: string
  env?: Record<string, string>
  healthTimeout?: number
}

export class ServerManager {
  private proc: ReturnType<typeof Bun.spawn> | null = null
  private port: number | null = null
  private readonly command: string
  private readonly env: Record<string, string>
  private readonly healthTimeout: number

  constructor(opts: ServerManagerOptions) {
    this.command = opts.command
    this.env = opts.env ?? {}
    this.healthTimeout = opts.healthTimeout ?? 60_000
  }

  async start(): Promise<{ port: number; url: string }> {
    if (this.proc) throw new Error("Server already started")

    const port = await this.findFreePort()
    const cmd = this.command.replace(/__PORT__/g, String(port))
    const parts = cmd.split(/\s+/)

    this.proc = Bun.spawn(parts, {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, ...this.env },
    })
    this.port = port

    const url = `http://127.0.0.1:${port}`
    await this.waitForHealth(url)
    return { port, url }
  }

  async stop(): Promise<void> {
    if (!this.proc) return

    this.proc.kill("SIGTERM")

    const timeout = setTimeout(() => {
      if (this.proc) this.proc.kill("SIGKILL")
    }, 5000)

    await this.proc.exited
    clearTimeout(timeout)
    this.proc = null
    this.port = null
  }

  isRunning(): boolean {
    return this.proc !== null && this.proc.exitCode === null
  }

  getUrl(): string | null {
    return this.port ? `http://127.0.0.1:${this.port}` : null
  }

  onExit(callback: (exitCode: number | null) => void): void {
    if (this.proc) {
      this.proc.exited.then((code) => {
        if (this.proc?.exitCode !== null) {
          callback(code)
        }
      })
    }
  }

  private async findFreePort(): Promise<number> {
    const server = Bun.serve({ port: 0, fetch() { return new Response() } })
    const port = server.port
    server.stop()
    return port
  }

  private async waitForHealth(url: string): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < this.healthTimeout) {
      try {
        const resp = await fetch(`${url}/q/health/ready`)
        if (resp.ok) return
      } catch {
        // not ready yet
      }

      if (this.proc?.exitCode !== null) {
        const stderr = await new Response(this.proc!.stderr).text()
        throw new Error(`Server exited with ${this.proc!.exitCode}:\n${stderr}`)
      }

      await Bun.sleep(500)
    }

    await this.stop()
    throw new Error(`Server did not become healthy within ${this.healthTimeout}ms`)
  }
}
