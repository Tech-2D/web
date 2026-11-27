// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, expect, it, vi } from 'vitest'
import { AgendaClosureAdmin } from './AgendaClosureAdmin'
import { agendaClosureRequest, closureTemplates } from './agendaClosure'

vi.mock('./agendaClosure', async original => ({
  ...await original<typeof import('./agendaClosure')>(),
  agendaClosureRequest: vi.fn(),
}))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('previews a custom title, saves a private draft and requires confirmation before closing', async () => {
  const title = 'Recesso de dezembro'
  const revised = { ...closureTemplates[0].screen, title }
  const request = vi.mocked(agendaClosureRequest)
  request.mockResolvedValueOnce({ revision: 0, draft: null, published: null })
  request.mockResolvedValueOnce({ revision: 1, draft: revised, published: null })
  request.mockResolvedValueOnce({ revision: 2, draft: revised, published: revised })
  const user = { uid: 'admin' } as User
  render(<AgendaClosureAdmin user={user} />)

  fireEvent.change(await screen.findByLabelText('Título'), { target: { value: title } })
  expect(screen.getByRole('heading', { name: title })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Prévia no celular' }))
  expect(screen.getByRole('button', { name: 'Prévia no celular' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
  await screen.findByText('Rascunho salvo.')
  expect(screen.getByText('Agenda aberta')).toBeTruthy()
  expect(request).toHaveBeenLastCalledWith(user, true, undefined, expect.objectContaining({ action: 'save', revision: 0 }))
  fireEvent.click(screen.getByRole('button', { name: 'Publicar e fechar Agenda' }))
  expect(request).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  await screen.findByText('Agenda fechada')
  expect(request).toHaveBeenLastCalledWith(user, true, undefined, expect.objectContaining({ action: 'publish', revision: 1 }))
})
