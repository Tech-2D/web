// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RecoveryAgenda } from './RecoveryAgenda'
import { recoveryInputDateTime, type RecoveryEdition } from './recovery'

afterEach(cleanup)

it('starts with the selected class and keeps shared lessons visible when the filter changes', () => {
  const common = { date: '2026-12-07', start: '09:30', end: '10:20', teacher: null, room: null }
  const period: RecoveryEdition = {
    id: 1, startsAt: '2026-12-07T11:00:00.000Z', endsAt: '2026-12-09T20:00:00.000Z',
    title: 'Edital final', description: 'Leve seu material.', link: 'https://example.org/edital.pdf',
    lessons: [
      { ...common, subject: 'Matemática', className: '2° TECH D' },
      { ...common, subject: 'Inglês', className: '2° TECH E' },
      { ...common, subject: 'Plantão', className: null },
    ],
  }
  const onCalendar = vi.fn()
  render(<RecoveryAgenda period={period} turmaId="2° TECH D" onCalendar={onCalendar} />)
  expect(screen.getByText('Matemática')).toBeTruthy()
  expect(screen.getByText('Plantão')).toBeTruthy()
  expect(screen.queryByText('Inglês')).toBeNull()
  expect(screen.getByRole('link', { name: 'Abrir edital' }).getAttribute('href')).toBe(period.link)
  fireEvent.change(screen.getByRole('combobox', { name: 'Turma' }), { target: { value: '' } })
  expect(screen.getByText('Inglês')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Ver Agenda normal' }))
  expect(onCalendar).toHaveBeenCalledOnce()
  expect(recoveryInputDateTime(period.startsAt)).toBe('2026-12-07T08:00')
})
