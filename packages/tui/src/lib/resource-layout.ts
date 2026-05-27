export function shortName(fullName: string): string {
  const m = fullName.match(/^(.+?)-[a-f0-9]{7,10}-[a-z0-9]{5}$/)
  if (m) return m[1]
  const m2 = fullName.match(/^(.+?)-[a-f0-9]{7,10}$/)
  if (m2) return m2[1]
  return fullName
}

export function hashSuffix(fullName: string): string {
  const s = shortName(fullName)
  return s === fullName ? "" : fullName.slice(s.length)
}

export function truncate(s: string, max: number): string {
  if (max < 1) return ""
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}

export function listBadge(cells: string[]): string {
  return cells.length > 2 ? cells[2] : ""
}

export function computeDetailWidth(totalWidth: number, sidebarWidth: number): number {
  return Math.max(36, Math.floor((totalWidth - sidebarWidth) * 0.48))
}

export function computeListWidth(totalWidth: number, sidebarWidth: number, detailWidth: number, detailOpen: boolean): number {
  if (!detailOpen) return totalWidth - sidebarWidth - 4
  return totalWidth - sidebarWidth - detailWidth - 4
}
