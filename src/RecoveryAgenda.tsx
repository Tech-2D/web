import { ArrowLeft, CalendarClock, Clock3, GraduationCap, MapPin, UserRound } from 'lucide-react'
import { useState } from 'react'
import { PageHeading } from './PageHeading'
import { formatRecoveryTime, type RecoveryEdition, type RecoveryLesson } from './recovery'
import './recovery.css'

const dayLabel = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
})
const weekdayLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' })
const monthLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long' })
const lessonCount = (count: number) => count + (count === 1 ? ' aula' : ' aulas')

export function RecoveryAgenda({ period, turmaId, onCalendar }: {
  period: RecoveryEdition
  turmaId: string | null
  onCalendar: () => void
}) {
  const [selection, setSelection] = useState<string>()
  const filter = selection ?? turmaId ?? ''
  const classes = [...new Set([...period.lessons.map(lesson => lesson.className), turmaId]
    .filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const days = new Map<string, RecoveryLesson[]>()
  for (const lesson of period.lessons) {
    if (filter && lesson.className && lesson.className !== filter) continue
    const lessons = days.get(lesson.date) ?? []
    lessons.push(lesson)
    days.set(lesson.date, lessons)
  }
  const total = [...days.values()].reduce((count, lessons) => count + lessons.length, 0)

  return (
    <main id="inicio" className="main-content portal-main recovery">
      <div className="interface-panel recovery-panel recovery-overview">
        <div className="recovery-heading">
          <PageHeading icon={GraduationCap} title="Recuperação" />
          <button type="button" className="portal-control recovery-action" onClick={onCalendar}><ArrowLeft size={17} /> Ver Agenda normal</button>
        </div>
        <div className="recovery-period">
          <CalendarClock size={17} aria-hidden="true" />
          <div>
            <span>Período de recuperação</span>
            <p><time dateTime={period.startsAt}>{formatRecoveryTime(period.startsAt)}</time> até <time dateTime={period.endsAt}>{formatRecoveryTime(period.endsAt)}</time> · Brasília</p>
          </div>
        </div>
      </div>
      <section className="interface-panel recovery-panel recovery-schedule" aria-labelledby="recovery-schedule">
        <div className="recovery-heading recovery-schedule-heading">
          <div>
            <h2 id="recovery-schedule">Horários das aulas</h2>
            {total > 0 && <p role="status">{lessonCount(total)} em {days.size} {days.size === 1 ? 'dia' : 'dias'}</p>}
          </div>
          <label className="recovery-filter">Turma
            <select className="portal-control" value={filter} onChange={event => setSelection(event.target.value)}>
              <option value="">Todas as turmas</option>
              {classes.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>
        {days.size === 0 ? <div className="recovery-schedule-empty">
          <CalendarClock size={24} aria-hidden="true" />
          <p>{period.lessons.length ? 'Nenhuma aula cadastrada para esta turma.' : 'Os horários de recuperação ainda não foram divulgados.'}</p>
          {filter && period.lessons.length > 0 && <button type="button" className="portal-control" onClick={() => setSelection('')}>Ver todas as turmas</button>}
        </div> : [...days].map(([date, lessons]) => {
          const day = new Date(date + 'T12:00:00Z')
          return (
            <div className="recovery-day" key={date}>
              <h3><time className="recovery-day-heading" dateTime={date}>
                <span className="sr-only">{dayLabel.format(day)}</span>
                <span className="recovery-day-number" aria-hidden="true">{day.getUTCDate()}</span>
                <span className="recovery-day-label" aria-hidden="true"><span>{weekdayLabel.format(day)}</span><small>{monthLabel.format(day)}</small></span>
              </time></h3>
              <ul className="recovery-day-list">
                {lessons.map((lesson, index) => (
                  <li className="recovery-class-card" key={index}>
                    <div className="recovery-time">
                      <Clock3 size={16} aria-hidden="true" />
                      <span><time dateTime={date + 'T' + lesson.start}>{lesson.start}</time>–<time dateTime={date + 'T' + lesson.end}>{lesson.end}</time></span>
                    </div>
                    <div className="recovery-class-details">
                      <strong>{lesson.subject}</strong>
                      {(lesson.teacher || lesson.room) && <div className="recovery-class-meta">
                        {lesson.teacher && <span><UserRound size={15} aria-hidden="true" />{lesson.teacher}</span>}
                        {lesson.room && <span><MapPin size={15} aria-hidden="true" />{lesson.room}</span>}
                      </div>}
                    </div>
                    <span className="recovery-class-label">{lesson.className ?? 'Todas as turmas'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </main>
  )
}
