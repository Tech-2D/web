import { CalendarClock, Check, ClipboardList, Clock3, GraduationCap, List, ListFilter, MapPin, Search, Table2, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeading } from './PageHeading'
import { formatRecoveryTime, recoveryKind, recoverySubject, type RecoveryEdition, type RecoveryLesson } from './recovery'
import { normalize } from './professores/schedule'
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

type RecoveryDay = { date: string; day: Date; lessons: RecoveryLesson[]; exams: number }

function LessonDetails({ lesson }: { lesson: RecoveryLesson }) {
  return <div className="recovery-class-details">
    <div className="recovery-class-subject">
      <strong>{recoverySubject(lesson.subject)}</strong>
      {isExam(lesson) && <span className="recovery-exam-badge">Prova</span>}
    </div>
    <div className="recovery-class-meta">
      {lesson.teacher && <span><UserRound size={15} aria-hidden="true" />{lesson.teacher}</span>}
      <span><MapPin size={15} aria-hidden="true" />{lesson.room || 'Local não informado'}</span>
    </div>
  </div>
}

function RecoveryGrid({ days }: { days: RecoveryDay[] }) {
  const starts = new Set<string>()
  const columns = days.map(day => {
    const slots = new Map<string, RecoveryLesson[]>()
    for (const lesson of day.lessons) {
      starts.add(lesson.start)
      const entries = slots.get(lesson.start) ?? []
      entries.push(lesson)
      slots.set(lesson.start, entries)
    }
    return { ...day, slots }
  })

  return <div className="timetable-scroll recovery-grid-scroll" role="region" aria-label="Grade de recuperação" tabIndex={0}>
    <table className="timetable recovery-grid" aria-label="Horários por dia" style={{ minWidth: (5 + columns.length * 10) + 'rem' }}>
      <thead><tr>
        <th scope="col">Início</th>
        {columns.map(({ date, day, exams }) => <th scope="col" id={'recuperacao-' + date} key={date} tabIndex={-1} data-exam-day={exams > 0}>
          <time dateTime={date}>{shortDate.format(day)}</time>
          <small>{weekdayLabel.format(day)}{exams > 0 && ' · ' + examCount(exams)}</small>
        </th>)}
      </tr></thead>
      <tbody>{[...starts].sort().map(start => <tr key={start}>
        <th scope="row">{start}</th>
        {columns.map(({ date, slots }) => <td key={date}>
          {slots.get(start)?.map((lesson, index) => <article className="recovery-grid-lesson" data-exam={isExam(lesson)} key={index}>
            <p className="recovery-grid-time">{lesson.start}–{lesson.end}</p>
            <LessonDetails lesson={lesson} />
            <span className="recovery-class-label">{lesson.className ?? 'Todas as turmas'}</span>
          </article>)}
        </td>)}
      </tr>)}</tbody>
    </table>
  </div>
}

export function RecoverySchedule({ period, turmaId }: {
  period: RecoveryEdition
  turmaId: string | null
}) {
  const [selection, setSelection] = useState<string>()
  const [onlyExams, setOnlyExams] = useState(false)
  const [search, setSearch] = useState('')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const terms = normalize(search).split(/\s+/).filter(Boolean)
  const filter = selection ?? (terms.length ? '' : turmaId ?? '')
  const classes = [...new Set([...period.lessons.map(lesson => lesson.className), turmaId]
    .filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const days = new Map<string, RecoveryLesson[]>()
  for (const lesson of period.lessons) {
    if (filter && lesson.className && lesson.className !== filter) continue
    if (terms.length) {
      const searchable = normalize([lesson.teacher, recoverySubject(lesson.subject), lesson.room, lesson.className].join(' '))
      if (!terms.every(term => searchable.includes(term))) continue
    }
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
  const visibleDays = onlyExams ? examDays.map(day => ({ ...day, lessons: day.lessons.filter(isExam) })) : schedule
  const totals = [!onlyExams && lessonTotal > 0 ? lessonCount(lessonTotal) : '', examTotal ? examCount(examTotal) : ''].filter(Boolean)

  return (
    <div className="recovery">
      <div className="interface-panel recovery-panel recovery-overview">
        <div className="recovery-heading">
          <PageHeading icon={GraduationCap} title="Recuperação" />
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
          <div className="interface-segments recovery-layout" role="group" aria-label="Visualização da recuperação">
            <button type="button" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><Table2 size={16} aria-hidden="true" /> Grade</button>
            <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><List size={16} aria-hidden="true" /> Lista</button>
          </div>
        </div>
        <div className="recovery-search-row">
          <div className="portal-search">
            <Search size={18} aria-hidden="true" />
            <input type="search" aria-label="Buscar na recuperação" placeholder="Buscar professor, matéria, turma ou local"
              value={search} onChange={event => setSearch(event.target.value)} />
            {search && <button type="button" className="portal-control recovery-clear-search" aria-label="Limpar busca"
              onClick={() => setSearch('')}><X size={16} aria-hidden="true" /></button>}
          </div>
          <label className="recovery-filter">Turma
            <select className="portal-control" value={filter} onChange={event => setSelection(event.target.value)}>
              <option value="">Todas as turmas</option>
              {classes.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>
        {(examDays.length > 0 || onlyExams) && <div className="recovery-exam-summary">
          <div className="recovery-exam-header">
            <h3><span className="recovery-exam-icon"><ClipboardList size={18} aria-hidden="true" /></span> Datas das provas</h3>
            <button type="button" className="portal-control recovery-exam-toggle" aria-pressed={onlyExams} onClick={() => setOnlyExams(value => !value)}>
              {onlyExams ? <Check size={17} aria-hidden="true" /> : <ListFilter size={17} aria-hidden="true" />}
              Mostrar só provas
            </button>
          </div>
          {examDays.length > 0 && <nav aria-label="Datas das provas de recuperação">
            <ul>
              {examDays.map(({ date, day, exams }) => <li key={date}>
                <a className="portal-control recovery-exam-date" href={'#recuperacao-' + date}
                  onClick={event => {
                    const section = document.getElementById('recuperacao-' + date)
                    if (!section) return
                    event.preventDefault()
                    section.focus({ preventScroll: true })
                    section.scrollIntoView({ block: 'start', inline: 'nearest' })
                  }}>
                  <time dateTime={date}><span className="sr-only">{dayLabel.format(day)}</span><span aria-hidden="true">{shortDate.format(day)}</span></time>
                  <span className="recovery-exam-count">{examCount(exams)}</span>
                </a>
              </li>)}
            </ul>
          </nav>}
        </div>}
        {visibleDays.length === 0 ? <div className="recovery-schedule-empty">
          <CalendarClock size={24} aria-hidden="true" />
          <p>{terms.length ? 'Nenhum resultado para essa busca.' : onlyExams ? 'Nenhuma prova marcada para a turma selecionada.' : period.lessons.length ? 'Nenhum horário cadastrado para esta turma.' : 'Os horários de recuperação ainda não foram divulgados.'}</p>
          {!onlyExams && filter && period.lessons.length > 0 && <button type="button" className="portal-control" onClick={() => setSelection('')}>Ver todas as turmas</button>}
        </div> : layout === 'grid' ? <RecoveryGrid days={visibleDays} /> : visibleDays.map(({ date, day, lessons, exams }) => {
          return (
            <div className="recovery-day" id={'recuperacao-' + date} role="group" aria-labelledby={'recovery-day-title-' + date} tabIndex={-1} key={date}>
              <h3 className="recovery-day-title" id={'recovery-day-title-' + date}><time className="recovery-day-heading" dateTime={date}>
                <span className="sr-only">{dayLabel.format(day)}</span>
                <span className="recovery-day-number" aria-hidden="true">{day.getUTCDate()}</span>
                <span className="recovery-day-label" aria-hidden="true"><span>{weekdayLabel.format(day)}</span><small>{monthLabel.format(day)}</small></span>
              </time>{exams > 0 && <span className="recovery-exam-badge"><ClipboardList size={14} aria-hidden="true" /> Dia de prova</span>}</h3>
              <ul className="recovery-day-list">
                {lessons.map((lesson, index) => (
                  <li className="recovery-class-card" data-exam={isExam(lesson)} key={index}>
                    <div className="recovery-time">
                      <Clock3 size={16} aria-hidden="true" />
                      <span><time dateTime={date + 'T' + lesson.start}>{lesson.start}</time>–<time dateTime={date + 'T' + lesson.end}>{lesson.end}</time></span>
                    </div>
                    <LessonDetails lesson={lesson} />
                    <span className="recovery-class-label">{lesson.className ?? 'Todas as turmas'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}
