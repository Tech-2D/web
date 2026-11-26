// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, expect, it, vi } from 'vitest'
import { ClassLinkForm } from './ClassLinkForm'
import { classLinkRequest } from './classLink'

vi.mock('./classLink', () => ({ classLinkRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const user = { uid: 'aluno' } as User
const classes = ['2° TECH D', '2° TECH E']

it('saves the first class and lets the server determine the cooldown', async () => {
  const result = { link: { className: classes[0] }, canChange: false, availableAt: '2027-01-01T00:00:00Z' }
  vi.mocked(classLinkRequest).mockResolvedValueOnce(result)
  const onSave = vi.fn()
  render(<ClassLinkForm user={user} data={{ classes, link: null, canChange: true, availableAt: null }} onSave={onSave} />)
  fireEvent.change(screen.getByLabelText('Sua turma'), { target: { value: classes[0] } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar turma' }))
  expect(await screen.findByText('Turma salva no seu perfil.')).toBeTruthy()
  expect(classLinkRequest).toHaveBeenCalledWith(user, false, { action: 'save', className: classes[0] })
  expect(onSave).toHaveBeenCalledWith(result)
})

it('sends a correction request while the class is locked', async () => {
  const link = { className: classes[0], changedAt: new Date().toISOString(), requestedAt: null, requestedClass: null }
  const availableAt = new Date(Date.now() + 86400000).toISOString()
  vi.mocked(classLinkRequest).mockResolvedValueOnce({ link: { ...link, requestedClass: classes[1] }, canChange: false, availableAt })
  render(<ClassLinkForm user={user} data={{ classes, link, canChange: false, availableAt }} onSave={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Nova turma'), { target: { value: classes[1] } })
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar correção' }))
  expect(await screen.findByText('Pedido enviado à administração.')).toBeTruthy()
  expect(classLinkRequest).toHaveBeenCalledWith(user, false, { action: 'request', className: classes[1] })
})
