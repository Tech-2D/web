// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, expect, it, vi } from 'vitest'
import { RecoveryAdminPanel } from './RecoveryAdminPanel'
import { recoveryRequest } from './recovery'

vi.mock('./recovery', async importOriginal => ({
  ...await importOriginal<typeof import('./recovery')>(),
  recoveryRequest: vi.fn(),
}))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('imports and saves schedules from the file picker, preserving the metadata of an existing edition', async () => {
  const draft = { id: 2, title: 'Edital antigo', description: 'Material', link: 'https://example.org/documento', lessons: [] }
  const request = vi.mocked(recoveryRequest)
  request.mockResolvedValueOnce({ draft, publication: null, publicationAvailable: true })
  request.mockResolvedValueOnce({ draft: { ...draft, id: 3 } })
  render(<RecoveryAdminPanel user={{ uid: 'owner' } as User} classNames={['2° TECH D']} />)

  const picker = await screen.findByLabelText('Escolher arquivo')
  expect(picker.getAttribute('accept')).toBe('.xlsx,.json')
  expect(screen.queryByLabelText('Título')).toBeNull()
  expect(screen.queryByLabelText('Link do edital')).toBeNull()
  const file = Object.assign(new File([], 'grade.json'), {
    text: async () => JSON.stringify([{ data: '2026-12-07', início: '08:00', fim: '08:50', matéria: 'Matemática' }]),
  })
  fireEvent.change(picker, { target: { files: [file] } })
  fireEvent.click(await screen.findByRole('button', { name: 'Usar horários importados' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar horários' }))
  expect(await screen.findByText('Horários salvos.')).toBeTruthy()
  expect(request.mock.calls[1][3]).toEqual({
    action: 'save', version: 2, title: draft.title, description: draft.description, link: draft.link,
    lessons: [{ date: '2026-12-07', start: '08:00', end: '08:50', subject: 'Matemática', className: '', teacher: '', room: '' }],
  })
})
