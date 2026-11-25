import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { API_BASE } from './apiBase'

export interface RecoveryLesson {
  date: string
  start: string
  end: string
  subject: string
  className: string | null
  teacher: string | null
  room: string | null
}

export interface RecoveryPublication {
  id: number
  startsAt: string
  endsAt: string
}

export interface RecoveryContent {
  id: number
  title: string
  description: string
  link: string | null
  lessons: RecoveryLesson[]
}

export type RecoveryEdition = RecoveryContent & RecoveryPublication

export async function recoveryRequest<T>(user: User, admin: boolean, signal?: AbortSignal, input?: unknown): Promise<T> {
  const token = await user.getIdToken()
  const response = await fetch(API_BASE + (admin ? '/api/admin/recovery' : '/api/recovery'), {
    method: input ? 'POST' : 'GET',
    headers: input ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : { Authorization: 'Bearer ' + token },
    body: input ? JSON.stringify(input) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || 'Não foi possível acessar a recuperação.')
  }
  return response.json()
}

const periodDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
})
export const formatRecoveryTime = (value: string) => periodDate.format(new Date(value))

export function useRecoveryMode(user: User | null, enabled: boolean) {
  const [current, setCurrent] = useState<{ uid: string; period: RecoveryEdition | null }>()
  useEffect(() => {
    if (!user || !enabled) return
    const account = user
    const controller = new AbortController()
    let next = 0
    let expiry = 0
    let loading = false
    async function load() {
      if (loading || document.hidden || controller.signal.aborted) return
      window.clearTimeout(next)
      loading = true
      let delay = 60000
      try {
        const { period, nextCheckAt } = await recoveryRequest<{ period: RecoveryEdition | null; nextCheckAt?: string }>(account, false, controller.signal)
        if (controller.signal.aborted) return
        setCurrent({ uid: account.uid, period })
        window.clearTimeout(expiry)
        if (period) {
          const remaining = Math.max(100, Date.parse(period.endsAt) - Date.now())
          if (remaining <= 2147483647) {
            expiry = window.setTimeout(() => setCurrent({ uid: account.uid, period: null }), remaining)
          }
        }
        if (nextCheckAt) delay = Math.max(500, Math.min(delay, Date.parse(nextCheckAt) - Date.now()))
      } catch {
        if (!controller.signal.aborted) setCurrent({ uid: account.uid, period: null })
      } finally {
        loading = false
        if (!controller.signal.aborted) next = window.setTimeout(load, delay)
      }
    }
    void load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', load)
    return () => {
      controller.abort()
      window.clearTimeout(next)
      window.clearTimeout(expiry)
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', load)
    }
  }, [enabled, user])

  const resolved = current?.uid === user?.uid
  const period = enabled && resolved ? current?.period : null
  return { period: period && Date.parse(period.endsAt) > Date.now() ? period : null,
    checking: Boolean(enabled && user && !resolved) }
}
