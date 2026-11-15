import { expect, it } from 'vitest'
import { accessTimeline, type AccessStatistics } from './siteAccess'

const counts = (authenticated: number) => ({ authenticated, anonymous: 0, accounts: authenticated })
const statistics: AccessStatistics = {
  today: '2026-03-02',
  professorSince: '2026-02-28',
  pegakiSince: '2026-03-01',
  sites: {
    agenda: { total: counts(3), daily: [{ date: '2026-03-02', ...counts(3) }] },
    professores: { total: counts(2), daily: [{ date: '2026-02-28', ...counts(2) }] },
    pegaki: { total: counts(1), daily: [{ date: '2026-03-01', ...counts(1) }] },
  },
}

it('fills missing days in chronological order and keeps unavailable history distinct from zero', () => {
  const rows = accessTimeline(statistics, 7)
  expect(rows).toHaveLength(7)
  expect(rows[0]).toEqual({ date: '2026-02-24', total: null, sites: { agenda: null, professores: null, pegaki: null, kanban: null } })
  expect(rows[4]).toEqual({ date: '2026-02-28', total: 2, sites: { agenda: 0, professores: 2, pegaki: null, kanban: null } })
  expect(rows[6]).toEqual({ date: '2026-03-02', total: 3, sites: { agenda: 3, professores: 0, pegaki: 0, kanban: null } })
  expect(rows.reduce((sum, row) => sum + (row.total ?? 0), 0)).toBe(6)
})

it('preserves Agenda history when Professores and Notas have no records', () => {
  const rows = accessTimeline({ ...statistics, professorSince: null, pegakiSince: null, sites: { ...statistics.sites, pegaki: undefined } }, 30)
  expect(rows[0].sites).toEqual({ agenda: 0, professores: null, pegaki: null, kanban: null })
  expect(rows.at(-1)?.total).toBe(3)
})

it('adds Kanban to daily totals only after separate tracking begins', () => {
  const rows = accessTimeline({ ...statistics, kanbanSince: '2026-03-01', sites: {
    ...statistics.sites, kanban: { total: counts(4), daily: [{ date: '2026-03-01', ...counts(4) }] },
  } }, 7)
  expect(rows[4].sites.kanban).toBeNull()
  expect(rows[5]).toMatchObject({ total: 5, sites: { kanban: 4 } })
  expect(rows[6].sites.kanban).toBe(0)
})
