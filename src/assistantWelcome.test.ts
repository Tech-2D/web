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

    expect(welcome.greeting).toBe('Boa noite, Júlia!')
    expect(welcome.notes[0]).toEqual({ topic: 'agenda', label: 'Na Agenda · Hoje, 22:30', text: 'Prova de inglês' })
    expect(welcome.notes[1]?.text).toContain('Ainda tem 2 atividades na Agenda.')
    expect(welcome.questions).toContainEqual({ topic: 'agenda', text: 'Quando é a próxima prova?' })
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

    expect(welcome.greeting).toBe('Boa noite!')
    expect(welcome.notes[0]).toMatchObject({ topic: 'kanban', label: 'No seu Kanban', text: expect.stringContaining('Um cartão passou do prazo.') })
    expect(welcome.notes.map(note => note.text).join(' ')).not.toContain(task.title)
  })
})
