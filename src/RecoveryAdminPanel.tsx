import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { FileUp, Plus, Trash2 } from 'lucide-react'
import { formatRecoveryTime, recoveryRequest, type RecoveryContent, type RecoveryLesson, type RecoveryPublication } from './recovery'
import { importRecoveryFile, RECOVERY_SUBJECT_OPTIONS } from './recoveryImport'
import './recovery.css'

type RecoveryState = { draft: RecoveryContent | null; publication: RecoveryPublication | null; publicationAvailable: boolean }
const emptyDraft: RecoveryContent = { id: 0, title: 'Recuperação', description: '', link: '', lessons: [] }

export function RecoveryAdminPanel({ user, classNames }: { user: User; classNames: string[] }) {
  const [data, setData] = useState<RecoveryState>()
  const [draft, setDraft] = useState(emptyDraft)
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [days, setDays] = useState('7')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [preview, setPreview] = useState<RecoveryLesson[]>([])
  const [manualOpen, setManualOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const controller = new AbortController()
    void recoveryRequest<RecoveryState>(user, true, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setData(result)
      setDraft(result.draft ?? emptyDraft)
      setDirty(false)
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message)
    })
    return () => controller.abort()
  }, [reloadKey, user])

  useEffect(() => {
    if (!data?.publication) return
    const interval = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(interval)
  }, [data?.publication])

  function updateLessons(lessons: RecoveryLesson[]) {
    setDraft(current => ({ ...current, lessons }))
    setDirty(true)
    setMessage('')
  }

  function updateLesson(index: number, changes: Partial<RecoveryLesson>) {
    updateLessons(draft.lessons.map((lesson, at) => at === index ? { ...lesson, ...changes } : lesson))
  }

  const publication = data?.publication && Date.parse(data.publication.endsAt) > now ? data.publication : null
  const scheduled = publication && Date.parse(publication.startsAt) > now
  const canActivate = data?.publicationAvailable && draft.id > 0 && !dirty && !preview.length &&
    Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 90

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setImporting(true)
    setPreview([])
    setImportError('')
    try {
      setPreview(await importRecoveryFile(file, classNames))
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Não foi possível importar os horários.')
    } finally {
      setImporting(false)
    }
  }

  async function execute(action: 'save' | 'activate' | 'deactivate') {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const input = action === 'save' ? { action, version: draft.id, title: draft.title, description: draft.description,
        link: draft.link ?? '', lessons: draft.lessons.map(lesson => ({ ...lesson,
          teacher: lesson.teacher ?? '', room: lesson.room ?? '', className: lesson.className ?? '' })) }
        : action === 'activate' ? { action, version: draft.id, days: Number(days) }
          : { action, version: publication?.id, startsAt: publication?.startsAt }
      const result = await recoveryRequest<Partial<RecoveryState>>(user, true, undefined, input)
      setNow(Date.now())
      setData(current => current && { ...current, ...result })
      if (result.draft) {
        setDraft(result.draft)
        setDirty(false)
      }
      setMessage(action === 'save' ? 'Horários salvos.' : action === 'activate' ? 'Modo de recuperação ativado.' : 'Modo de recuperação desligado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void execute('save')
  }

  function reload() {
    if ((dirty || preview.length) && !window.confirm('Descartar as alterações locais e atualizar o painel?')) return
    setError('')
    setMessage('')
    setImportError('')
    setPreview([])
    setData(undefined)
    setReloadKey(value => value + 1)
  }

  if (!data) return (
    <section className="interface-panel recovery-panel">
      {error ? <><p role="alert">{error}</p><button type="button" className="portal-control" onClick={reload}>Tentar novamente</button></>
        : <p role="status">Carregando período de recuperação…</p>}
    </section>
  )

  return (
    <div className="recovery">
      <section className="interface-panel recovery-panel" aria-label="Publicação da recuperação">
        <div className="recovery-heading">
          <h2>{!data.publicationAvailable ? 'Status da recuperação indisponível' : scheduled ? 'Recuperação agendada' : publication ? 'Modo de recuperação ativo' : 'Modo de recuperação desligado'}</h2>
          <button className="portal-control" type="button" disabled={busy || importing} onClick={reload}>Atualizar painel</button>
        </div>
        {publication && <p className="recovery-window">{formatRecoveryTime(publication.startsAt)} até {formatRecoveryTime(publication.endsAt)} · Brasília</p>}
        {publication && publication.id !== draft.id && <p>A nova grade será usada na próxima ativação.</p>}
        {publication ? <div className="recovery-actions">
          <button className="portal-control" type="button" disabled={busy || importing}
            onClick={() => void execute('deactivate')}>Desligar recuperação</button>
        </div> : <form className="recovery-actions" onSubmit={event => {
          event.preventDefault()
          if (canActivate) void execute('activate')
        }}>
          <label>Duração em dias<input className="portal-control" type="number" min={1} max={90} step={1}
            required value={days} disabled={busy} onChange={event => setDays(event.target.value)} /></label>
          <button className="portal-control recovery-primary" type="submit" disabled={!canActivate || busy || importing}>Ativar recuperação</button>
        </form>}
        {!publication && <p className="recovery-window">De 1 a 90 dias. O prazo começa ao ativar.</p>}
        {!publication && (dirty || !draft.id) && <p>Salve os horários antes de ativar a recuperação.</p>}
      </section>
      {error && <p className="interface-panel recovery-panel" role="alert">{error}</p>}
      {message && <p className="interface-panel recovery-panel" role="status">{message}</p>}
      <form className="interface-panel recovery-panel recovery-form" onSubmit={submit}>
        <fieldset disabled={busy || importing}>
          <legend>Horários das aulas</legend>
          <div className="recovery-import">
            <h4>Importar horários</h4>
            <div className="recovery-import-controls">
              <label className="portal-control recovery-file-picker">
                <FileUp size={17} aria-hidden="true" /> Escolher arquivo
                <input type="file" accept=".xlsx,.json" aria-describedby="recovery-import-format"
                  disabled={busy || importing} onChange={event => void chooseFile(event)} />
              </label>
              <span id="recovery-import-format">Excel (.xlsx) ou JSON</span>
            </div>
            <p>Use a primeira aba do Excel com Data, Início, Fim e Matéria. Turma, Professor e Local são opcionais. Use as matérias e turmas da Agenda.</p>
            <details>
              <summary>Ver exemplo de JSON</summary>
              <pre>{JSON.stringify([{ data: '07/12/2026', início: '08:00', fim: '08:50', matéria: 'Matemática', turma: classNames[0] ?? '', professor: '', local: '' }], null, 2)}</pre>
            </details>
            {importing && <p role="status">Lendo horários…</p>}
            {importError && <p role="alert">{importError}</p>}
            {!!preview.length && <div className="recovery-import-preview">
              <p role="status">{preview.length} {preview.length === 1 ? 'aula validada' : 'aulas validadas'}. {draft.lessons.length > 0 && 'O arquivo substitui a grade em edição.'}</p>
              <ul>
                {preview.slice(0, 3).map((lesson, index) => <li key={index}>
                  {lesson.date.split('-').reverse().join('/')} · {lesson.start}–{lesson.end} · {lesson.subject}{lesson.className && ' · ' + lesson.className}
                </li>)}
              </ul>
              <div className="recovery-actions">
                <button className="portal-control" type="button" onClick={() => { updateLessons(preview); setPreview([]) }}>Usar horários importados</button>
                <button className="portal-control" type="button" onClick={() => setPreview([])}>Cancelar importação</button>
              </div>
            </div>}
          </div>
          {!!draft.lessons.length && <details className="recovery-lesson-list" open={manualOpen}
            onToggle={event => setManualOpen(event.currentTarget.open)} onInvalidCapture={() => setManualOpen(true)}>
            <summary>Revisar e editar {draft.lessons.length} {draft.lessons.length === 1 ? 'aula' : 'aulas'}</summary>
            {manualOpen && draft.lessons.map((lesson, index) => (
              <div className="recovery-lesson" key={index} role="group" aria-label={'Aula ' + (index + 1)}>
                <div className="recovery-fields">
                  <label>Matéria<select className="portal-control" required value={lesson.subject} onChange={e => updateLesson(index, { subject: e.target.value })}>
                    <option value="" disabled>Selecione uma matéria</option>
                    {lesson.subject && !RECOVERY_SUBJECT_OPTIONS.includes(lesson.subject) &&
                      <option value={lesson.subject} disabled>{lesson.subject} (fora do catálogo)</option>}
                    {RECOVERY_SUBJECT_OPTIONS.map(subject => <option key={subject}>{subject}</option>)}
                  </select></label>
                  <label>Turma<select className="portal-control" value={lesson.className ?? ''} onChange={e => updateLesson(index, { className: e.target.value })}>
                    <option value="">Todas as turmas</option>
                    {lesson.className && !classNames.includes(lesson.className) &&
                      <option value={lesson.className} disabled>{lesson.className} (fora do catálogo)</option>}
                    {classNames.map(name => <option key={name}>{name}</option>)}
                  </select></label>
                  <label>Data<input type="date" className="portal-control" required value={lesson.date} onChange={e => updateLesson(index, { date: e.target.value })} /></label>
                  <div className="recovery-fields">
                    <label>Início<input type="time" className="portal-control" required value={lesson.start} onChange={e => updateLesson(index, { start: e.target.value })} /></label>
                    <label>Fim<input type="time" className="portal-control" required value={lesson.end} onChange={e => updateLesson(index, { end: e.target.value })} /></label>
                  </div>
                  <label>Professor<input className="portal-control" maxLength={120} value={lesson.teacher ?? ''} onChange={e => updateLesson(index, { teacher: e.target.value })} /></label>
                  <label>Local<input className="portal-control" maxLength={120} value={lesson.room ?? ''} onChange={e => updateLesson(index, { room: e.target.value })} /></label>
                </div>
                <button type="button" className="portal-control recovery-action" onClick={() => updateLessons(draft.lessons.filter((_, at) => at !== index))}><Trash2 size={16} /> Remover aula</button>
              </div>
            ))}
          </details>}
          <button type="button" className="portal-control recovery-action"
            onClick={() => {
              updateLessons([...draft.lessons, { date: '', start: '', end: '', subject: '', className: '', teacher: '', room: '' }])
              setManualOpen(true)
            }}>
            <Plus size={17} /> Adicionar aula
          </button>
        </fieldset>
        <button type="submit" className="portal-control recovery-primary" disabled={!dirty || busy || importing || !!preview.length}>{busy ? 'Aguarde…' : 'Salvar horários'}</button>
      </form>
    </div>
  )
}
