// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, expect, it, vi } from 'vitest'
import { AgendaUsersPanel } from './AgendaUsersPanel'

vi.mock('./firebase', () => ({ auth: { currentUser: { uid: 'admin' } } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('opens a single account analysis, changes the period and returns to the list', async () => {
  const user = { uid: 'admin', getIdToken: async () => 'session' } as User
  const fetchMock = vi.fn(async (url: string) => {
    const params = new URL(url).searchParams
    if (params.get('view') === 'profile') {
      return Response.json({
        profile: { name: 'Aluna de teste', email: 'aluna@example.test', role: 'representante',
          className: '2° TECH D', classSource: 'assignment', blockedUntil: null },
        daily: params.get('days') === '30' ? [{ date: '2026-11-23', visits: 2, messages: 3,
          agenda: 1, professores: 0, pegaki: 1, kanban: 0 }] : [],
      })
    }
    return Response.json({ users: [{ uid: 'student', email: 'aluna@example.test', lastVisitDay: null,
      protected: false, blocked: false, blockId: null, blockedUntil: null }], blocks: [], totalUsers: 1 })
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<AgendaUsersPanel user={user} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Ver análise' }))
  expect(await screen.findByText('2° TECH D')).toBeTruthy()
  expect(screen.getByText('Representante')).toBeTruthy()
  expect(screen.getByRole('table', { name: 'Atividade registrada por dia' }).textContent).toContain('23/11/2026')
  expect(fetchMock.mock.calls.some(([url]) => url.includes('view=profile&uid=student&days=30'))).toBe(true)
  fireEvent.change(screen.getByLabelText('Período da análise'), { target: { value: '7' } })
  expect(await screen.findByText('Sem atividade registrada neste período.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Voltar aos usuários' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ver análise' })).toBeTruthy())
})
