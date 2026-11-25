import { canCreateActivityCard } from './activityFuture'
import type { KanbanBoard } from './kanban'
import type { Activity } from './types'

export type WelcomeActivity = Pick<Activity, 'title' | 'date' | 'time' | 'type' | 'turmaId'>

const dateKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' })
const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const hour = new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' })

export function buildWelcome(name: unknown, turma: string | null, activities: readonly WelcomeActivity[], boards: readonly KanbanBoard[], now: Date) {
  const firstName = typeof name === 'string' ? name.trim().split(/\s+/)[0] : ''
  const safeName = firstName && /^[\p{L}][\p{L}\p{M}'’-]{0,29}$/u.test(firstName) ? firstName : ''
  const localHour = Number(hour.format(now))
  const greeting = localHour < 12 ? 'Bom dia' : localHour < 18 ? 'Boa tarde' : 'Boa noite'
  const today = dateKey.format(now)
  const upcoming = activities.filter(activity => (activity.turmaId === null || activity.turmaId === turma) && canCreateActivityCard(activity, now))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '23:59').localeCompare(b.time ?? '23:59'))
  const next = upcoming[0]
  const overdue = boards.reduce((count, board) => {
    const openColumns = new Set(board.columns.filter(column => !column.done).map(column => column.id))
    return count + board.tasks.filter(task => openColumns.has(task.columnId) && task.dueDate && task.dueDate < today).length
  }, 0)

  const notes: string[] = []
  if (next) {
    const when = next.date === today ? 'hoje' : dateLabel.format(new Date(next.date + 'T12:00:00Z'))
    notes.push(`Próxima atividade · ${next.title} (${when})`)
    const count = upcoming.filter(activity => activity.date === today).length
    if (count > 1) notes.push(`Ainda há ${count} atividades na Agenda de hoje.`)
  }
  if (overdue) notes.push(overdue === 1 ? 'Você tem 1 cartão com prazo vencido no Kanban pessoal.' : `Você tem ${overdue} cartões com prazo vencido no Kanban pessoal.`)
  notes.push('Posso consultar a Agenda, encontrar horários de professores ou ajudar a criar cartões no Kanban.')

  return {
    greeting: `${greeting}${safeName ? `, ${safeName}` : ''}! Eu sou o D2.`,
    notes,
    questions: [
      next?.date === today ? 'O que ainda tem na Agenda hoje?' : 'O que tem na Agenda esta semana?',
      upcoming.some(activity => activity.type === 'prova') ? 'Qual é a próxima prova?' : 'Como consulto os horários dos professores?',
      'Crie um card para revisar o conteúdo da semana',
    ],
  }
}
