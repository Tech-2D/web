// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RecoverySchedule } from './RecoverySchedule'
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
  render(<RecoverySchedule period={period} turmaId="2° TECH D" />)
  expect(screen.getByText('Matemática')).toBeTruthy()
  expect(screen.getByText('Plantão')).toBeTruthy()
  expect(screen.getByText('Professora Ana')).toBeTruthy()
  expect(screen.getByText('Sala 8')).toBeTruthy()
  expect(screen.getByRole('table', { name: 'Horários por dia' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: /07\/12.*segunda-feira/ })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: '09:30' })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('2 aulas em 1 dia')
  expect(screen.queryByText('Inglês')).toBeNull()
  expect(screen.queryByText(period.title)).toBeNull()
  expect(screen.queryByRole('link', { name: 'Abrir edital' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Turma' }), { target: { value: '' } })
  expect(screen.getByText('Inglês')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('3 aulas em 1 dia')
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
      { ...common, date: '2026-12-04', subject: 'Matemática', className: '2° TECH E', kind: 'exam', teacher: 'João Nunes', room: 'Sala 8' },
    ],
  }
  render(<RecoverySchedule period={period} turmaId="2° TECH D" />)
  const examDate = screen.getByRole('link', { name: /1 de dezembro.*1 prova/ })
  expect(examDate.getAttribute('href')).toBe('#recuperacao-2026-12-01')
  expect(screen.queryByRole('link', { name: /4 de dezembro/ })).toBeNull()
  const examColumn = screen.getByRole('columnheader', { name: /01\/12.*1 prova/ })
  examColumn.scrollIntoView = vi.fn()
  fireEvent.click(examDate)
  expect(document.activeElement).toBe(examColumn)
  expect(examColumn.scrollIntoView).toHaveBeenCalledWith({ block: 'start', inline: 'nearest' })
  expect(screen.getByText('Sociologia')).toBeTruthy()
  const filter = screen.getByRole('button', { name: 'Mostrar só provas' })
  expect(filter.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(filter)
  expect(filter.getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByText('Estatística')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Lista' }))
  expect(screen.getByRole('heading', { name: /1 de dezembro.*Dia de prova/ })).toBeTruthy()
  expect(screen.queryByText('Estatística')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Grade' }))
  expect(screen.getByRole('table', { name: 'Horários por dia' })).toBeTruthy()
  fireEvent.click(filter)
  expect(filter.getAttribute('aria-pressed')).toBe('false')
  expect(screen.getByText('Estatística')).toBeTruthy()
  fireEvent.click(filter)
  fireEvent.change(screen.getByRole('combobox', { name: 'Turma' }), { target: { value: '2° TECH E' } })
  expect(screen.getByRole('link', { name: /4 de dezembro/ })).toBeTruthy()
  expect(screen.queryByText('Sociologia')).toBeNull()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar na recuperação' }), { target: { value: 'joao sala 8' } })
  expect(screen.getByText('João Nunes')).toBeTruthy()
  expect(screen.getByText('Sala 8')).toBeTruthy()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar na recuperação' }), { target: { value: 'sala 25' } })
  expect(screen.getByText('Nenhum resultado para essa busca.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }))
  expect(screen.getByText('João Nunes')).toBeTruthy()
})
