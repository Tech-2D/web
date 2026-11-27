// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RecoveryAgenda } from './RecoveryAgenda'
import { formatRecoveryTime, type RecoveryEdition } from './recovery'

afterEach(cleanup)

it('starts with the selected class and keeps shared lessons visible when the filter changes', () => {
  const common = { date: '2026-12-07', start: '09:30', end: '10:20', teacher: null, room: null }
  const period: RecoveryEdition = {
    id: 1, startsAt: '2026-12-07T11:00:00.000Z', endsAt: '2026-12-09T20:00:00.000Z',
    title: 'Edital final', description: 'Leve seu material.', link: 'https://example.org/edital.pdf',
    lessons: [
      { ...common, subject: 'Matemática', className: '2° TECH D', teacher: 'Professora Ana', room: 'Sala 8' },
      { ...common, subject: 'Inglês', className: '2° TECH E' },
      { ...common, subject: 'Plantão', className: null },
    ],
  }
  const onCalendar = vi.fn()
  render(<RecoveryAgenda period={period} turmaId="2° TECH D" onCalendar={onCalendar} />)
  expect(screen.getByText('Matemática')).toBeTruthy()
  expect(screen.getByText('Plantão')).toBeTruthy()
  expect(screen.getByText('Professora Ana')).toBeTruthy()
  expect(screen.getByText('Sala 8')).toBeTruthy()
  expect(screen.getByRole('heading', { name: /7 de dezembro/ })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('2 aulas em 1 dia')
  expect(screen.queryByText('Inglês')).toBeNull()
  expect(screen.queryByText(period.title)).toBeNull()
  expect(screen.queryByRole('link', { name: 'Abrir edital' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Turma' }), { target: { value: '' } })
  expect(screen.getByText('Inglês')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('3 aulas em 1 dia')
  fireEvent.click(screen.getByRole('button', { name: 'Ver Agenda normal' }))
  expect(onCalendar).toHaveBeenCalledOnce()
  expect(formatRecoveryTime(period.startsAt)).toContain('08:00')
})

it('highlights and filters exam dates for the active class, including old schedules', () => {
  const common = { start: '09:30', end: '10:20', teacher: null, room: null }
  const period: RecoveryEdition = {
    id: 1, startsAt: '2026-11-26T11:00:00Z', endsAt: '2026-12-05T20:00:00Z',
    title: 'Recuperação', description: '', link: null,
    lessons: [
      { ...common, date: '2026-11-27', subject: 'Estatística', className: '2° TECH D' },
      { ...common, date: '2026-12-01', subject: 'Sociologia (Prova)', className: '2° TECH D' },
      { ...common, date: '2026-12-04', subject: 'Matemática', className: '2° TECH E', kind: 'exam' },
    ],
  }
  render(<RecoveryAgenda period={period} turmaId="2° TECH D" onCalendar={() => {}} />)
  expect(screen.getByRole('link', { name: /1 de dezembro.*1 prova/ }).getAttribute('href')).toBe('#recuperacao-2026-12-01')
  expect(screen.queryByRole('link', { name: /4 de dezembro/ })).toBeNull()
  expect(screen.getByRole('heading', { name: /1 de dezembro.*Dia de prova/ })).toBeTruthy()
  expect(screen.getByText('Sociologia')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar só provas' }))
  expect(screen.queryByText('Estatística')).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Turma' }), { target: { value: '2° TECH E' } })
  expect(screen.getByRole('link', { name: /4 de dezembro/ })).toBeTruthy()
  expect(screen.queryByText('Sociologia')).toBeNull()
})
