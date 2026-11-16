import { apiUrl } from './apiBase'

// Public catalog reads (agenda, horários, atualizações, avisos) come from the SQL API.
// There is no fallback: the old Render/Redis snapshots no longer reflect current data.
export async function fetchCatalog(resource: string, className: string | undefined, signal: AbortSignal, token?: string): Promise<Response> {
  const url = apiUrl('/api/catalog/' + resource)
  if (className) url.searchParams.set('class', className)
  return fetch(url, { ...(token ? { headers: { Authorization: 'Bearer ' + token }, redirect: 'error' } : {}), signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) })
}
