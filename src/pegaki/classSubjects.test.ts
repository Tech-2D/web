import { expect, it } from 'vitest'
import { findTechClass, subjectsForClass } from './classSubjects'

it('resolves Agenda and Professores class names while keeping AD and DS distinct', () => {
  expect(findTechClass('2° TECH D')).toEqual({ name: '2º Tec D', year: 2 })
  expect(findTechClass('1º Tec G')).toEqual({ name: '1º Tec G', year: 1 })
  expect(findTechClass('3° TECH AD H')).toEqual({ name: '3º Tec AD H', year: 3 })
  expect(findTechClass('3° TECH DS G')).toEqual({ name: '3º Tec DS G', year: 3 })
  expect(findTechClass('1º Neg A')).toBeUndefined()
})

it('uses only active schedules of the selected class and preserves notebook subject keys', () => {
  const schedules = [
    { className: '3º Tec AD H', subject: 'Ciência de Dados', active: true },
    { className: '3º Tec DS G', subject: 'Programaçâo Assíncrona', active: true },
    { className: '3º Tec DS G', subject: 'Lingua Inglêsa', active: true },
    { className: '3º Tec DS G', subject: 'Lingua inglesa', active: true },
    { className: '3º Tec DS G', subject: 'Matemática', active: false },
  ]
  expect(subjectsForClass('3º Tec DS G', schedules)).toEqual(['Língua Inglesa', 'Programaçâo Assíncrona'])
  expect(subjectsForClass('3º Tec AD H', schedules)).toEqual(['Ciência de Dados'])
})
