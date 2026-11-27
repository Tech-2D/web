import { CLASS_NAMES } from '../professores/classNames'
import { normalize } from '../professores/schedule'
import type { Schedule } from '../professores/types'
import type { Year } from './data/subjects'

type TechClass = { name: string; year: Year }

export const TECH_CLASSES: TechClass[] = CLASS_NAMES.flatMap(name => {
  const grade = /^[123](?=º Tec )/.exec(name)
  return grade ? [{ name, year: Number(grade[0]) as Year }] : []
})

function classKey(name: string) {
  return normalize(name).replace(/[º°ª]/g, ' ').replace(/\btech\b/g, 'tec').replace(/\s+/g, ' ')
}

export function findTechClass(name: string | null): TechClass | undefined {
  if (!name) return undefined
  return TECH_CLASSES.find(turma => classKey(turma.name) === classKey(name))
}

// A grade pode usar outra grafia. Preserve as chaves da API e dos cadernos antigos.
const NOTEBOOK_NAMES = new Map([
  ['Desenvolvimento de Aplicação Dinâmica', 'Desenvolvimento Aplicação Dinâmica'],
  ['Engenharia e Qualidae de Software', 'Engenharia e Qualidade de Software'],
  ['Língua Portuguesa e Suas Literaturas', 'Língua Portuguesa e suas Literaturas'],
  ['Matemática 9-Banco de dados', 'Matemática 9-Banco de Dados'],
  ['Lingua inglesa', 'Língua Inglesa'],
  ['Lingua Inglêsa', 'Língua Inglesa'],
  ['Biologia 2 - ESG', 'Biologia 2-ESG-Environment, Social and Governance'],
  ['Matemática 14-Inteligência Artificial', 'Matemática 14 - Inteligência Artificial'],
])

export function subjectsForClass(className: string, schedules: Pick<Schedule, 'active' | 'className' | 'subject'>[]): string[] {
  const subjects = new Set<string>()
  for (const schedule of schedules) {
    if (!schedule.active || schedule.className !== className) continue
    const subject = NOTEBOOK_NAMES.get(schedule.subject) ?? schedule.subject
    if (subject) subjects.add(subject)
  }
  return [...subjects].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
