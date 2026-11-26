import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { API_BASE } from './apiBase'

export type ClassLink = { className: string; changedAt: string; requestedClass: string | null; requestedAt: string | null }
export type ClassStatus = { link: ClassLink | null; canChange: boolean; availableAt: string | null }
export type ClassCatalog = ClassStatus & { classes: string[] }

export async function classLinkRequest<T>(user: User, admin = false, input?: object, signal?: AbortSignal): Promise<T> {
  const token = await user.getIdToken()
  const timeout = AbortSignal.timeout(15000)
  const response = await fetch(API_BASE + (admin ? '/api/admin/class-links' : '/api/profile/class'), {
    method: input ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(input && { 'Content-Type': 'application/json' }) },
    body: input ? JSON.stringify(input) : undefined,
    cache: 'no-store', redirect: 'error',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw Error(result?.message ?? 'Não foi possível consultar sua turma.')
  return result
}

export function useClassLink(user: User | null) {
  const [state, setState] = useState<{ uid: string; data?: ClassCatalog; error?: string }>()
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    void classLinkRequest<ClassCatalog>(user, false, undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ uid: user.uid, data })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ uid: user.uid, error: error.message })
    })
    return () => controller.abort()
  }, [user, retry])

  function update(next: ClassStatus) {
    setState(current => current?.uid === user?.uid && current?.data
      ? { ...current, data: { ...current.data, ...next } } : current)
  }
  function reload() {
    setState(undefined)
    setRetry(value => value + 1)
  }
  const current = state?.uid === user?.uid ? state : undefined
  return { data: current?.data, error: current?.error, update, reload }
}
