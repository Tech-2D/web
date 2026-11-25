import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { importRecoveryFile, parseRecoveryJson, parseRecoverySheet } from './recoveryImport'

const classes = ['2° TECH D']
const row = { data: '07/12/2026', início: '8:00', fim: '08:50', matéria: 'Matemática', turma: '2º tech d', local: 'Sala 8' }

describe('importação de horários de recuperação', () => {
  it('importa um arquivo Excel com células de data e hora', async () => {
    const data = await readFile(new URL('../test/fixtures/horarios-recuperacao.xlsx', import.meta.url))
    const file = new File([new Uint8Array(data)], 'horarios-recuperacao.xlsx')
    await expect(importRecoveryFile(file, classes)).resolves.toEqual([{
      date: '2026-12-07', start: '08:00', end: '08:50', subject: 'Matemática', className: classes[0], teacher: 'Ana', room: 'Sala 8',
    }])
  })
  it('converte os campos em português e os usados na importação de professores', () => {
    const actual = parseRecoveryJson(JSON.stringify([row, {
      date: '2026-12-08', startTime: '09:00', endTime: '10:00', subject: 'Biologia',
      className: '', professor: 'Ana', roomDescription: 'Lab',
    }]), classes)
    expect(actual).toEqual([
      { date: '2026-12-07', start: '08:00', end: '08:50', subject: 'Matemática', className: classes[0], teacher: null, room: 'Sala 8' },
      { date: '2026-12-08', start: '09:00', end: '10:00', subject: 'Biologia', className: null, teacher: 'Ana', room: 'Lab' },
    ])
  })

  it('lê linhas do Excel com datas e horários nativos', () => {
    const serial = (Date.UTC(2026, 11, 7) - Date.UTC(1899, 11, 30)) / 86400000
    const result = parseRecoverySheet([
      ['Matéria', 'Turma', 'Data', 'Início', 'Fim', 'Local'],
      ['Matemática', classes[0], serial, 8 / 24, 530 / 1440, 8],
      [null, null, null, null, null, null],
      ['Inglês', 'Todas as turmas', new Date('2026-12-08T00:00:00Z'), '8:00', '08:50:00', null],
    ], classes)
    expect(result).toMatchObject([
      { date: '2026-12-07', className: classes[0], start: '08:00', end: '08:50', room: '8' },
      { date: '2026-12-08', className: null, start: '08:00', end: '08:50' },
    ])
  })

  it('identifica registro e campo quando a grade é inválida', () => {
    expect(() => parseRecoveryJson(JSON.stringify([row, { ...row, data: '31/11/2026' }]), classes)).toThrow(/Registro 2.*data/)
    expect(() => parseRecoveryJson(JSON.stringify([row, row]), classes)).toThrow(/Registro 2.*repetida/)
    expect(() => parseRecoveryJson(JSON.stringify([{ ...row, turma: 'Turma errada' }]), classes)).toThrow(/Registro 1.*turma/)
    expect(() => parseRecoverySheet([['data', 'início'], ['07/12/2026', '08:00']], classes)).toThrow(/primeira linha/)
    expect(() => parseRecoverySheet([['data', 'início', 'fim', 'matéria'], ['07/12/2026', '09:00', '08:00', 'Biologia']], classes)).toThrow(/Linha 2.*horários/)
  })
})
