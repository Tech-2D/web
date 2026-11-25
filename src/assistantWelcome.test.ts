import { describe, expect, it } from 'vitest'
import { buildWelcome, type WelcomeActivity } from './assistantWelcomeContext'
import type { KanbanBoard } from './kanban'

const now = new Date('2026-11-25T01:00:00Z') // 22h do dia 24 em Brasília

describe('D2 welcome', () => {
  it('highlights relevant activities using the local day and time', () => {
    const activity: WelcomeActivity = { title: 'Prova de inglês', date: '2026-11-24', time: '22:30', turmaId: '2D', type: 'prova' }
    const welcome = buildWelcome('  Júlia Silva ', '2D', [
      { ...activity, time: '22:15', turmaId: '2E', title: 'Outra turma' },
      { ...activity, time: '21:00', title: 'Atividade encerrada' },
      { ...activity, time: '23:00', turmaId: null, title: 'Atividade geral' },
      activity,
    ], [], now)

    expect(welcome.greeting).toBe('Boa noite, Júlia! Eu sou o D2.')
    expect(welcome.notes).toContain('Próxima atividade · Prova de inglês (hoje)')
    expect(welcome.notes).toContain('Ainda há 2 atividades na Agenda de hoje.')
    expect(welcome.questions).toContain('Qual é a próxima prova?')
  })

  it('counts only overdue, unfinished cards and falls back to a generic greeting for an email', () => {
    const task = { id: 'a', columnId: 'open', title: 'Título privado', description: '', priority: 'none' as const, labels: [], checklist: [] }
    const board: KanbanBoard = {
      id: 'personal', name: 'Pessoal', color: 'blue', compact: false,
      columns: [{ id: 'open', name: 'A fazer', color: 'blue', done: false }, { id: 'done', name: 'Concluído', color: 'green', done: true }],
      tasks: [
        { ...task, dueDate: '2026-11-23' },
        { ...task, id: 'b', dueDate: '2026-11-24' },
        { ...task, id: 'c', columnId: 'done', dueDate: '2026-11-23' },
      ],
    }
    const welcome = buildWelcome('aluno@example.com', null, [], [board], now)

    expect(welcome.greeting).toBe('Boa noite! Eu sou o D2.')
    expect(welcome.notes).toContain('Você tem 1 cartão com prazo vencido no Kanban pessoal.')
    expect(welcome.notes.join(' ')).not.toContain(task.title)
  })
})
