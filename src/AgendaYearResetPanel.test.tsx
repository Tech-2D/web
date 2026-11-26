// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { reauthenticateWithCredential, type User } from 'firebase/auth'
import { afterEach, expect, it, vi } from 'vitest'
import { AgendaYearResetPanel } from './AgendaYearResetPanel'

vi.mock('./firebase', () => ({ auth: { currentUser: { uid: 'owner' } } }))
vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: vi.fn(() => 'credential') },
  reauthenticateWithCredential: vi.fn(async () => undefined),
}))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

it('shows a preview and requires the phrase and reauthentication before sending the command', async () => {
  const user = { uid: 'owner', email: 'admin@example.test', getIdToken: async () => 'token' } as User
  const counts = { activities: 2, recurrences: 1, attachments: 1, representatives: 1 }
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method === 'POST') expect(reauthenticateWithCredential).toHaveBeenCalledWith(user, 'credential')
    return Response.json({ counts, revision: 'preview-revision', readOnly: false })
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<AgendaYearResetPanel user={user} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Preparar limpeza' }))
  const submit = screen.getByRole('button', { name: 'Confirmar limpeza definitiva' }) as HTMLButtonElement
  fireEvent.change(screen.getByLabelText('Sua senha'), { target: { value: 'senha-de-teste' } })
  expect(submit.disabled).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText(/Digite/), { target: { value: 'LIMPAR AGENDA' } })
  fireEvent.click(submit)
  expect(await screen.findByText(/Limpeza registrada/)).toBeTruthy()
  const post = fetchMock.mock.calls.find(([, request]) => request.method === 'POST')?.[1]
  expect(JSON.parse(String(post?.body))).toMatchObject({ confirmation: 'LIMPAR AGENDA', revision: 'preview-revision' })
  expect(post?.body).not.toContain('senha-de-teste')
})
