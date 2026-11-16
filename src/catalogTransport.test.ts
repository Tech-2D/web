import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const API = 'https://tech-2d-agenda-sql.tech-2d-auth-email.workers.dev'
const ok = () => new Response('{}', { status: 200 })

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

it('reads the catalog from the SQL API and preserves class filters', async () => {
  const fetch = vi.fn().mockResolvedValue(ok())
  vi.stubGlobal('fetch', fetch)
  const { fetchCatalog } = await import('./catalogTransport')
  await fetchCatalog('agenda', '2° TECH D', new AbortController().signal, 'id-token')
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url, init] = fetch.mock.calls[0]
  expect(url.origin).toBe(API)
  expect(url.pathname).toBe('/api/catalog/agenda')
  expect(url.searchParams.get('class')).toBe('2° TECH D')
  expect(init.headers.Authorization).toBe('Bearer id-token')
})

it.each([429, 500, 503, 401, 404])('returns %s as is, without trying another backend', async status => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}', { status }))
  vi.stubGlobal('fetch', fetch)
  const { fetchCatalog } = await import('./catalogTransport')
  expect((await fetchCatalog('agenda', undefined, new AbortController().signal)).status).toBe(status)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('reports network failures instead of falling back to old snapshots', async () => {
  const fetch = vi.fn().mockRejectedValue(new Error('offline'))
  vi.stubGlobal('fetch', fetch)
  const { fetchCatalog } = await import('./catalogTransport')
  await expect(fetchCatalog('agenda', undefined, new AbortController().signal)).rejects.toThrow('offline')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('accepts a relative API address for the development proxy', async () => {
  vi.stubEnv('VITE_API_URL', '/tech2d-api')
  vi.stubGlobal('location', { origin: 'http://localhost:5173' })
  const fetch = vi.fn().mockResolvedValue(ok())
  vi.stubGlobal('fetch', fetch)
  const { fetchCatalog } = await import('./catalogTransport')
  await fetchCatalog('schedules', undefined, new AbortController().signal)
  expect(fetch.mock.calls[0][0].href).toBe('http://localhost:5173/tech2d-api/api/catalog/schedules')
})
