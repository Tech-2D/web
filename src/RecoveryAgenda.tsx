import { ArrowLeft, CalendarClock, ClipboardList, Clock3, GraduationCap, MapPin, UserRound } from 'lucide-react'
import { useState } from 'react'
import { PageHeading } from './PageHeading'
import { formatRecoveryTime, recoveryKind, recoverySubject, type RecoveryEdition, type RecoveryLesson } from './recovery'
import './recovery.css'

const dayLabel = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
})
const weekdayLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' })
const monthLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
const lessonCount = (count: number) => count + (count === 1 ? ' aula' : ' aulas')
const examCount = (count: number) => count + (count === 1 ? ' prova' : ' provas')
const isExam = (lesson: RecoveryLesson) => recoveryKind(lesson) === 'exam'

export function RecoveryAgenda({ period, turmaId, onCalendar }: {
  period: RecoveryEdition
  turmaId: string | null
  onCalendar: () => void
}) {
  const [selection, setSelection] = useState<string>()
  const [onlyExams, setOnlyExams] = useState(false)
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
  const schedule = [...days].map(([date, lessons]) => ({
    date, day: new Date(date + 'T12:00:00Z'), lessons, exams: lessons.filter(isExam).length,
  })).sort((left, right) => left.date.localeCompare(right.date))
  const examDays = schedule.filter(day => day.exams > 0)
  const examTotal = examDays.reduce((count, day) => count + day.exams, 0)
  const lessonTotal = schedule.reduce((count, day) => count + day.lessons.length - day.exams, 0)
  const visibleDays = onlyExams ? examDays : schedule
  const totals = [!onlyExams && lessonTotal > 0 ? lessonCount(lessonTotal) : '', examTotal ? examCount(examTotal) : ''].filter(Boolean)

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
            <h2 id="recovery-schedule">Horários da recuperação</h2>
            {visibleDays.length > 0 && <p role="status">{totals.join(' e ')} em {visibleDays.length} {visibleDays.length === 1 ? 'dia' : 'dias'}</p>}
          </div>
          <label className="recovery-filter">Turma
            <select className="portal-control" value={filter} onChange={event => setSelection(event.target.value)}>
              <option value="">Todas as turmas</option>
              {classes.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>
        {(examDays.length > 0 || onlyExams) && <div className="recovery-exam-summary">
          {examDays.length > 0 && <nav aria-label="Datas das provas de recuperação">
            <h3><ClipboardList size={18} aria-hidden="true" /> Datas das provas</h3>
            <ul>
              {examDays.map(({ date, day, exams }) => <li key={date}>
                <a className="portal-control recovery-exam-date" href={'#recuperacao-' + date}
                  onClick={event => {
                    const section = document.getElementById('recuperacao-' + date)
                    if (!section) return
                    event.preventDefault()
                    section.focus({ preventScroll: true })
                    section.scrollIntoView({ block: 'start' })
                  }}>
                  <time dateTime={date}><span className="sr-only">{dayLabel.format(day)}</span><span aria-hidden="true">{shortDate.format(day)}</span></time>
                  <span>{examCount(exams)}</span>
                </a>
              </li>)}
            </ul>
          </nav>}
          <label className="recovery-exam-toggle"><input type="checkbox" checked={onlyExams} onChange={event => setOnlyExams(event.target.checked)} /> Mostrar só provas</label>
        </div>}
        {visibleDays.length === 0 ? <div className="recovery-schedule-empty">
          <CalendarClock size={24} aria-hidden="true" />
          <p>{onlyExams ? 'Nenhuma prova marcada para a turma selecionada.' : period.lessons.length ? 'Nenhum horário cadastrado para esta turma.' : 'Os horários de recuperação ainda não foram divulgados.'}</p>
          {!onlyExams && filter && period.lessons.length > 0 && <button type="button" className="portal-control" onClick={() => setSelection('')}>Ver todas as turmas</button>}
        </div> : visibleDays.map(({ date, day, lessons, exams }) => {
          return (
            <div className="recovery-day" id={'recuperacao-' + date} role="group" aria-labelledby={'recovery-day-title-' + date} tabIndex={-1} key={date}>
              <h3 className="recovery-day-title" id={'recovery-day-title-' + date}><time className="recovery-day-heading" dateTime={date}>
                <span className="sr-only">{dayLabel.format(day)}</span>
                <span className="recovery-day-number" aria-hidden="true">{day.getUTCDate()}</span>
                <span className="recovery-day-label" aria-hidden="true"><span>{weekdayLabel.format(day)}</span><small>{monthLabel.format(day)}</small></span>
              </time>{exams > 0 && <span className="recovery-exam-badge"><ClipboardList size={14} aria-hidden="true" /> Dia de prova</span>}</h3>
              <ul className="recovery-day-list">
                {(onlyExams ? lessons.filter(isExam) : lessons).map((lesson, index) => (
                  <li className="recovery-class-card" data-exam={isExam(lesson)} key={index}>
                    <div className="recovery-time">
                      <Clock3 size={16} aria-hidden="true" />
                      <span><time dateTime={date + 'T' + lesson.start}>{lesson.start}</time>–<time dateTime={date + 'T' + lesson.end}>{lesson.end}</time></span>
                    </div>
                    <div className="recovery-class-details">
                      <div className="recovery-class-subject">
                        <strong>{recoverySubject(lesson.subject)}</strong>
                        {isExam(lesson) && <span className="recovery-exam-badge">Prova</span>}
                      </div>
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
