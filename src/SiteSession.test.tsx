// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SiteSession } from './SiteSession'

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
