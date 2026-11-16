import { auth } from './firebase'
import { fetchCatalog } from './catalogTransport'

export type CatalogMeta = { generatedAt: string; stale: boolean }
const CHANGED = 'tech2d-public-catalog-changed'

function hydrate(value: unknown, key = ''): unknown {
  if (typeof value === 'string' && ['createdAt', 'updatedAt', 'publishedAt'].includes(key) && Number.isFinite(Date.parse(value))) {
    return { toDate: () => new Date(value) }
  }
  if (Array.isArray(value)) return value.map(item => hydrate(item))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([field, item]) => [field, hydrate(item, field)]))
  return value
}

export function observeCatalog<T>(resource: 'schedules' | 'agenda' | 'updates', change: (data: T & { meta: CatalogMeta }) => void, error: () => void, className?: string) {
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout>
  let lastAttempt = 0
  let nextAllowed = 0
  const abort = new AbortController()
  async function poll() {
    if (stopped || running || document.hidden) return
    clearTimeout(timer)
    if (Date.now() < nextAllowed) {
      clearTimeout(timer)
      timer = setTimeout(() => void poll(), nextAllowed - Date.now())
      return
    }
    running = true
    lastAttempt = Date.now()
    let delay = 60000
    try {
      const response = await fetchCatalog(resource, className, abort.signal, await auth.currentUser?.getIdToken())
      if (!response.ok) {
        const retry = Number(response.headers.get('Retry-After'))
        delay = Math.max(60000, Math.min((retry || 120) * 1000, 300000))
        throw new Error('PUBLIC_QUERY_FAILED')
      }
      const data = hydrate(await response.json()) as T & { meta: CatalogMeta }
      if (!stopped) change(data)
      nextAllowed = 0
    } catch {
      if (!stopped) error()
      nextAllowed = Date.now() + delay
    } finally {
      running = false
      if (!stopped) timer = setTimeout(() => void poll(), delay)
    }
  }
  const wake = () => { if (Date.now() - lastAttempt > 10000) void poll() }
  const changed = () => { nextAllowed = 0; void poll() }
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('focus', wake)
  window.addEventListener(CHANGED, changed)
  void poll()
  return () => {
    stopped = true
    abort.abort()
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', wake)
    window.removeEventListener('focus', wake)
    window.removeEventListener(CHANGED, changed)
  }
}

export async function invalidateCatalog(target: 'schedules' | 'agenda'): Promise<boolean> {
  // The SQL API always serves current data; open views only need to reload.
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: { target } }))
  return true
}
