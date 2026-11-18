import { useEffect, useRef } from 'react'
import { parseAssistantError, parseAssistantResponse } from './assistantContract'

export type AssistantRoute = '/api/chat' | '/api/kanban'
type Session = { id: string; token?: string }

function closeSession(endpoint: string, session: Session | null) {
  if (!session?.token) return
  void fetch(endpoint + '/api/session/' + session.id, {
    method: 'DELETE', headers: { Authorization: 'Bearer ' + session.token }, keepalive: true,
  }).catch(() => {})
}

export async function assistantRequest(endpoint: string, path: AssistantRoute, body: Record<string, unknown>,
  token: string, sessionId: string, signal: AbortSignal) {
  const response = await fetch(endpoint + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, session_id: sessionId }),
    signal,
  })
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) return { ok: false as const, status: response.status, data: parseAssistantError(json) }
  return { ok: true as const, data: parseAssistantResponse(json) }
}

export function useAssistantTransport(account: { getIdToken: () => Promise<string> }, endpoint: string) {
  const session = useRef<Session | null>(null)
  const inFlight = useRef<AbortController | null>(null)

  useEffect(() => () => {
    inFlight.current?.abort()
    closeSession(endpoint, session.current)
    session.current = null
  }, [endpoint])

  function forget() {
    closeSession(endpoint, session.current)
    session.current = null
  }

  async function send(path: AssistantRoute, body: Record<string, unknown>, signal: AbortSignal) {
    const current = session.current ?? { id: crypto.randomUUID() }
    session.current = current
    const token = await account.getIdToken()
    signal.throwIfAborted()
    current.token = token
    return assistantRequest(endpoint, path, body, token, current.id, AbortSignal.any([signal, AbortSignal.timeout(90000)]))
  }

  return { send, forget, inFlight }
}
