import { ArrowLeft, CalendarClock, ExternalLink, GraduationCap } from 'lucide-react'
import { useState } from 'react'
import { PageHeading } from './PageHeading'
import { formatRecoveryTime, type RecoveryEdition, type RecoveryLesson } from './recovery'
import './recovery.css'

const dayLabel = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
})

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

  return (
    <main id="inicio" className="main-content portal-main recovery">
      <section className="interface-panel recovery-panel" aria-label="Edital de recuperação">
        <div className="recovery-heading">
          <PageHeading icon={GraduationCap} title="Recuperação" />
          <button type="button" className="portal-control recovery-action" onClick={onCalendar}><ArrowLeft size={17} /> Ver Agenda normal</button>
        </div>
        <h2>{period.title}</h2>
        <p className="recovery-window">{formatRecoveryTime(period.startsAt)} até {formatRecoveryTime(period.endsAt)} · Brasília</p>
        {period.description && <p className="recovery-description">{period.description}</p>}
        {period.link && <a className="recovery-action" href={period.link} target="_blank" rel="noreferrer">Abrir edital <ExternalLink size={16} /></a>}
      </section>
      <section className="interface-panel recovery-panel" aria-labelledby="recovery-schedule">
        <div className="recovery-heading">
          <h2 id="recovery-schedule"><CalendarClock size={21} /> Horários das aulas</h2>
          <label className="recovery-filter">Turma
            <select className="portal-control" value={filter} onChange={event => setSelection(event.target.value)}>
              <option value="">Todas as turmas</option>
              {classes.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>
        {days.size === 0 ? <p>{period.lessons.length ? 'Nenhuma aula cadastrada para esta turma.' : 'Os horários de recuperação ainda não foram divulgados.'}</p> :
          [...days].map(([date, lessons]) => (
            <div className="recovery-day" key={date}>
              <h3><time dateTime={date}>{dayLabel.format(new Date(date + 'T12:00:00Z'))}</time></h3>
              <ul>
                {lessons.map((lesson, index) => (
                  <li key={index}>
                    <span className="recovery-time">{lesson.start}–{lesson.end}</span>
                    <div>
                      <strong>{lesson.subject}</strong>
                      <p>{[lesson.className ?? 'Todas as turmas', lesson.teacher, lesson.room].filter(Boolean).join(' · ')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </section>
    </main>
  )
}
