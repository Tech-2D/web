// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SiteSession } from './SiteSession'
import type { User } from 'firebase/auth'
import type { AgendaSession } from './agendaSession'

const account = vi.hoisted(() => ({ uid: 'fixture', getIdToken: async () => 'fixture-token' }))
vi.mock('./firebase', async importOriginal => ({ ...await importOriginal<typeof import('./firebase')>(), auth: { currentUser: account } }))
vi.mock('firebase/auth', async importOriginal => ({ ...await importOriginal<typeof import('firebase/auth')>(),
  onAuthStateChanged: (_auth: unknown, callback: (user: typeof account) => void) => {
    callback(account)
    return () => {}
  },
}))

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('retries access in place and renders the portal only when the API confirms access', async () => {
  let finishRetry!: (response: Response) => void
  const request = vi.fn()
    .mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finishRetry = resolve }))
  vi.stubGlobal('fetch', request)
  render(<SiteSession destination="a Agenda"><p>Conteúdo protegido</p></SiteSession>)

  await screen.findByRole('heading', { name: 'Não foi possível verificar seu acesso' })
  expect(screen.queryByText('Conteúdo protegido')).toBeNull()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verificar novamente' })) })
  expect(screen.getByRole('status').textContent).toContain('Verificando sua sessão')
  expect(screen.queryByText('Conteúdo protegido')).toBeNull()
  expect(request).toHaveBeenCalledTimes(2)
  finishRetry(new Response(null, { status: 204 }))
  await screen.findByText('Conteúdo protegido')
})

it('shows separate instructions for a confirmed account block', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'agenda-access-blocked' }, { status: 403 })))
  render(<SiteSession destination="a Agenda"><p>Conteúdo protegido</p></SiteSession>)

  await screen.findByRole('heading', { name: 'Acesso ao portal bloqueado' })
  expect(screen.getByText('Fale com a administração do portal para obter ajuda.')).toBeDefined()
  expect(screen.queryByText('Conteúdo protegido')).toBeNull()
})

it('hides protected content when the browser preserves the page for back navigation', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
  const view = render(<SiteSession destination="a Agenda"><p>Conteúdo protegido</p></SiteSession>)
  await screen.findByText('Conteúdo protegido')

  window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false }))
  expect(document.documentElement.hasAttribute('data-site-restore-pending')).toBe(false)
  window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }))
  expect(document.documentElement.hasAttribute('data-site-restore-pending')).toBe(true)
  view.unmount()
  expect(document.documentElement.hasAttribute('data-site-restore-pending')).toBe(false)
})

it('waits for the Agenda context returned by the same bearer request', async () => {
  let finish!: (response: Response) => void
  const request = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', request)
  const content = vi.fn((_user: User, session: AgendaSession) => <p>{session.profile?.role} da turma {session.classLink.link?.className}</p>)

  await act(async () => {
    render(<SiteSession destination="a Agenda">{content}</SiteSession>)
  })
  expect(content).not.toHaveBeenCalled()
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith(expect.stringMatching(/\/api\/session\/access\?agenda=1$/),
    expect.objectContaining({ headers: { Authorization: 'Bearer fixture-token' } }))

  finish(Response.json({
    profile: { role: 'representante', turmaId: '2° TECH D' },
    classLink: { classes: ['2° TECH D'], link: { className: '2° TECH D' }, canChange: false, availableAt: null },
    screen: null,
  }))
  await screen.findByText('representante da turma 2° TECH D')
})
