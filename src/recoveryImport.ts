import { normalizeClassName } from './classRequests'
import type { RecoveryLesson } from './recovery'

export const MAX_RECOVERY_LESSONS = 200
const columns = {
  date: ['data', 'date'],
  start: ['inicio', 'start', 'starttime'],
  end: ['fim', 'end', 'endtime'],
  subject: ['materia', 'disciplina', 'subject'],
  className: ['turma', 'classname'],
  teacher: ['professor', 'teacher'],
  room: ['local', 'sala', 'room', 'roomdescription'],
} satisfies Record<keyof RecoveryLesson, string[]>

const columnNames = Object.keys(columns) as (keyof RecoveryLesson)[]
const required = columnNames.slice(0, 4)
const columnKey = (value: string) => value.normalize('NFD').replace(/\p{M}|[\s_-]/gu, '').toLowerCase()
const classKey = (name: string) => normalizeClassName(name).replace(/º/g, '°')
const dayMs = 86400000

function normalizeDate(value: unknown) {
  let date = value
  if (typeof date === 'number' && Number.isInteger(date) && date >= 61 && date < 2958466) {
    date = new Date(Date.UTC(1899, 11, 30) + date * dayMs)
  }
  if (date instanceof Date && Number.isFinite(+date)) date = date.toISOString().slice(0, 10)
  if (typeof date !== 'string') return ''
  const text = date.trim()
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  const iso = parts ? parts[3] + '-' + parts[2] + '-' + parts[1] : text
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso.startsWith('0000')) return ''
  const check = new Date(iso + 'T00:00:00Z')
  return Number.isFinite(+check) && check.toISOString().slice(0, 10) === iso ? iso : ''
}

function normalizeTime(value: unknown) {
  if (value instanceof Date && Number.isFinite(+value)) return value.toISOString().slice(11, 16)
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const minute = Math.round(value * 1440)
    if (minute < 1440 && Math.abs(value * 1440 - minute) < 0.0001) {
      return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')
    }
  }
  if (typeof value !== 'string') return ''
  const match = /^(\d{1,2}):([0-5]\d)(?::00)?$/.exec(value.trim())
  return match && Number(match[1]) < 24 ? match[1].padStart(2, '0') + ':' + match[2] : ''
}

function normalizeLessons(rows: { values: Record<string, unknown>; label: string }[], classes: string[]): RecoveryLesson[] {
  if (!rows.length || rows.length > MAX_RECOVERY_LESSONS) throw new Error('O arquivo deve conter de 1 a 200 aulas.')
  const available = new Map(classes.map(name => [classKey(name), name]))
  const seen = new Set<string>()
  return rows.map(({ values, label }) => {
    const keys = new Map(Object.entries(values).map(([key, value]) => [columnKey(key), value]))
    const get = (key: keyof RecoveryLesson) => keys.get(columns[key].find(alias => keys.has(alias)) ?? '')
    function readText(key: keyof RecoveryLesson, max: number) {
      const value = get(key)
      if (value == null) return ''
      if (key === 'room' && typeof value === 'number') return String(value)
      if (typeof value !== 'string' || value.trim().length > max) {
        throw new Error(label + ' — confira o campo ' + columns[key][0] + '.')
      }
      return value.trim()
    }

    const date = normalizeDate(get('date'))
    const start = normalizeTime(get('start'))
    const end = normalizeTime(get('end'))
    const subject = readText('subject', 120)
    if (!date) throw new Error(label + ' — informe uma data válida (DD/MM/AAAA ou AAAA-MM-DD).')
    if (!start || !end || end <= start) throw new Error(label + ' — confira os horários de início e fim.')
    if (!subject) throw new Error(label + ' — informe a matéria.')
    const inputClass = readText('className', 100)
    const className = !inputClass || classKey(inputClass) === 'TODAS AS TURMAS' ? null : available.get(classKey(inputClass))
    if (className === undefined) throw new Error(label + ' — turma não encontrada: ' + inputClass + '.')
    const teacher = readText('teacher', 120) || null
    const room = readText('room', 120) || null
    const identity = JSON.stringify([date, start, end, subject, className, teacher, room])
    if (seen.has(identity)) throw new Error(label + ' — esta aula está repetida no arquivo.')
    seen.add(identity)
    return { date, start, end, subject, className, teacher, room }
  })
}

export function parseRecoveryJson(text: string, classes: string[]) {
  let input: unknown
  try { input = JSON.parse(text) } catch { throw new Error('O arquivo não contém um JSON válido.') }
  if (!Array.isArray(input)) throw new Error('O JSON precisa conter uma lista de aulas.')
  if (input.length > MAX_RECOVERY_LESSONS) throw new Error('O arquivo deve conter de 1 a 200 aulas.')
  return normalizeLessons(input.map((values, index) => {
    const label = 'Registro ' + (index + 1)
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error(label + ' — informe os campos da aula.')
    return { values, label }
  }), classes)
}

export function parseRecoverySheet(sheet: unknown[][], classes: string[]) {
  const [header, ...rows] = sheet
  const names = header?.map(value => typeof value === 'string' ? columnKey(value) : '') ?? []
  if (!required.every(column => columns[column].some(alias => names.includes(alias)))) {
    throw new Error('A primeira linha do Excel deve ter as colunas Data, Início, Fim e Matéria.')
  }
  return normalizeLessons(rows.flatMap((cells, index) => cells.some(value => value != null && String(value).trim())
    ? [{ values: Object.fromEntries(names.map((name, col) => [name, cells[col]])), label: 'Linha ' + (index + 2) }]
    : []), classes)
}

export async function importRecoveryFile(file: File, classes: string[]) {
  if (file.size > 1024 * 1024) throw new Error('Escolha um arquivo de até 1 MB.')
  if (/\.json$/i.test(file.name)) return parseRecoveryJson(await file.text(), classes)
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Escolha um Excel (.xlsx) ou um JSON (.json).')
  const { readSheet } = await import('read-excel-file/browser')
  const rows = await readSheet(file).catch(() => { throw new Error('Não foi possível ler a primeira aba do Excel.') })
  return parseRecoverySheet(rows, classes)
}
