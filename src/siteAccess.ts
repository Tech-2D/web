export type AccessCounts = { authenticated: number; anonymous: number; accounts: number }
export type AccessSite = { total: AccessCounts; daily: (AccessCounts & { date: string })[] }
export const accessSiteLabels = { agenda: 'Agenda', professores: 'Professores', pegaki: 'Notas', kanban: 'Kanban' }
export type AccessSiteId = keyof typeof accessSiteLabels
export const accessSiteIds = Object.keys(accessSiteLabels) as AccessSiteId[]

export type AccessStatistics = {
  today: string
  agendaSince?: string | null
  professorSince: string | null
  pegakiSince?: string | null
  kanbanSince?: string | null
  sites: Record<'agenda' | 'professores', AccessSite> & Partial<Record<'pegaki' | 'kanban', AccessSite>>
  analytics?: UsageAnalytics
}

export type UsageAnalytics = {
  activeUsers: number; returningUsers: number; authenticatedAccesses: number
  previous: { accesses: number; accounts: number; available: boolean }
  topUsers: { uid: string; name: string | null; email?: string | null; className: string; accesses: number; activeDays: number; lastVisit: string; sites: Record<AccessSiteId, number> }[]
  classes: { className: string; accesses: number; accounts: number; activeDays: number; sites: Record<AccessSiteId, number> }[]
}

export type AccessDay = {
  date: string
  sites: Record<AccessSiteId, number | null>
  total: number | null
}

export const formatAccessCount = (value: number) => new Intl.NumberFormat('pt-BR').format(value)
export const accessCount = (value?: AccessCounts) => value ? value.authenticated + value.anonymous : 0
export const accessDateLabel = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('pt-BR', {
  day: '2-digit', month: '2-digit', timeZone: 'UTC',
})

export function accessTimeline(result: AccessStatistics, days: number): AccessDay[] {
  const daily = new Map(accessSiteIds.map(site => [site, new Map(result.sites[site]?.daily.map(row => [row.date, accessCount(row)]))]))
  const since = { agenda: result.agendaSince ?? result.professorSince, professores: result.professorSince, pegaki: result.pegakiSince, kanban: result.kanbanSince }
  const end = new Date(result.today + 'T12:00:00Z')
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(end)
    day.setUTCDate(day.getUTCDate() - days + index + 1)
    const date = day.toISOString().slice(0, 10)
    const sites = Object.fromEntries(accessSiteIds.map(site => {
      const covered = result.sites[site] && (since[site] ? date >= since[site] : site === 'agenda')
      return [site, covered ? daily.get(site)?.get(date) ?? 0 : null]
    })) as AccessDay['sites']
    const recorded = Object.values(sites).filter(value => value !== null)
    return { date, sites, total: recorded.length ? recorded.reduce((sum, value) => sum + value, 0) : null }
  })
}
