// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { calculateFromAverages } from '../lib/grades'
import { GradeAnalysis } from './GradeAnalysis'

afterEach(cleanup)

it('compares the same disciplines, counts zero and keeps unfinished semesters pending', () => {
  const onOpen = vi.fn()
  render(<GradeAnalysis onOpen={onOpen} onGradeEntry={vi.fn()} rows={[
    { name: 'Matemática', r: calculateFromAverages(0, 8, null) },
    { name: 'Português', r: calculateFromAverages(9, 5, null) },
    { name: 'História', r: calculateFromAverages(10, null, null) },
    { name: 'Biologia', r: calculateFromAverages(null, null, null) },
  ]} />)
  const overview = within(screen.getByRole('region', { name: 'Minha evolução' }))
  expect(overview.getByText('+2,00')).toBeTruthy()
  expect(overview.getByText('2 disciplinas com as duas médias')).toBeTruthy()
  const chart = within(screen.getByRole('region', { name: 'Comparativo por disciplina' }))
  expect(chart.getByText('0,00')).toBeTruthy()
  expect(chart.getByText('Pendente')).toBeTruthy()
  expect(chart.queryByRole('button', { name: 'Biologia' })).toBeNull()
  fireEvent.change(chart.getByLabelText('Ordenar por'), { target: { value: 'down' } })
  expect(chart.getAllByRole('button')[0].textContent).toBe('Português')
  fireEvent.click(chart.getByRole('button', { name: 'Matemática' }))
  expect(onOpen).toHaveBeenCalledWith('Matemática')
  expect(screen.getByRole('region', { name: 'Prioridades de estudo' }).textContent).toContain('Meta na recuperação final')
})

it('returns to grade entry when there are no completed semester averages', () => {
  const onGradeEntry = vi.fn()
  render(<GradeAnalysis onOpen={vi.fn()} onGradeEntry={onGradeEntry}
    rows={[{ name: 'Matemática', r: calculateFromAverages(null, null, null) }]} />)
  expect(screen.queryByRole('region', { name: 'Prioridades de estudo' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Lançar notas' }))
  expect(onGradeEntry).toHaveBeenCalledOnce()
})
