import type { User } from 'firebase/auth'
import { auth } from './firebase'
import { API_BASE } from './apiBase'

export async function recordCalendarAreaAccess(site: 'agenda' | 'kanban', account: User) {
  const response = await recordSiteAccess(site, account)
  if (response?.status !== 403) return false
  return (await response.json().catch(() => null))?.code === 'agenda-access-blocked'
}

export async function recordSiteAccess(site: 'agenda' | 'professor' | 'pegaki' | 'kanban', account: User | null) {
  try {
    const token = await account?.getIdToken()
    if (auth.currentUser?.uid !== account?.uid) return
    return await fetch(API_BASE + '/api/' + site + '-access', {
      method: 'POST',
      ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
      credentials: 'omit',
      redirect: 'error',
      keepalive: true,
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    // Reporting is best effort and does not block navigation.
  }
}
