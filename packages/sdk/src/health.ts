export async function checkHealth(baseUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`${baseUrl}/q/health/ready`);
    return { ok: resp.ok };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Connection failed' };
  }
}
