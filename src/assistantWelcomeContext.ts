import { canCreateActivityCard } from './activityFuture'
import type { KanbanBoard } from './kanban'
import type { Activity } from './types'

export type WelcomeActivity = Pick<Activity, 'title' | 'date' | 'time' | 'type' | 'turmaId'>
export type WelcomeTopic = 'agenda' | 'kanban' | 'professores' | 'd2'
type WelcomeNote = { topic: WelcomeTopic; label: string; text: string }

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

  const notes: WelcomeNote[] = []
  if (next) {
    const when = next.date === today ? 'Hoje' : dateLabel.format(new Date(next.date + 'T12:00:00Z'))
    notes.push({ topic: 'agenda', label: `Na Agenda · ${when}${next.time ? `, ${next.time}` : ''}`, text: next.title })
    const count = upcoming.filter(activity => activity.date === today).length
    if (count > 1) notes.push({ topic: 'agenda', label: 'No ritmo de hoje', text: `Ainda tem ${count} atividades na Agenda. Quer conferir quais são?` })
  }
  if (overdue) notes.push({
    topic: 'kanban', label: 'No seu Kanban',
    text: overdue === 1 ? 'Um cartão passou do prazo. Vale dar uma olhada quando puder.' : `${overdue} cartões passaram do prazo. Vale dar uma olhada quando puder.`,
  })
  notes.push({ topic: 'd2', label: 'Vale perguntar', text: 'Pode falar do seu jeito. Até um “o que tem pra hoje?” já dá pra começar.' })

  const questions: { topic: WelcomeTopic; text: string }[] = [
    { topic: 'agenda', text: next?.date === today ? 'O que ainda tem na Agenda hoje?' : 'O que tem na Agenda esta semana?' },
    upcoming.some(activity => activity.type === 'prova')
      ? { topic: 'agenda', text: 'Quando é a próxima prova?' }
      : { topic: 'professores', text: 'Como vejo os horários dos professores?' },
    { topic: 'kanban', text: 'Me ajuda a criar um card de revisão no Kanban?' },
  ]

  return {
    greeting: `${greeting}${safeName ? `, ${safeName}` : ''}!`,
    notes,
    questions,
  }
}
