import { useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { formatRecoveryTime, recoveryInputDateTime, recoveryRequest, type RecoveryEdition, type RecoveryLesson, type RecoveryPublication } from './recovery'
import './recovery.css'

type RecoveryState = { draft: RecoveryEdition | null; publication: RecoveryPublication | null; publicationAvailable: boolean }
const emptyDraft: RecoveryEdition = { id: 0, title: '', description: '', link: '', startsAt: '', endsAt: '', lessons: [] }

function editable(edition: RecoveryEdition | null) {
  if (!edition) return emptyDraft
  return { ...edition, startsAt: recoveryInputDateTime(edition.startsAt), endsAt: recoveryInputDateTime(edition.endsAt) }
}

export function RecoveryAdminPanel({ user, classNames }: { user: User; classNames: string[] }) {
  const [data, setData] = useState<RecoveryState>()
  const [draft, setDraft] = useState(emptyDraft)
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const controller = new AbortController()
    void recoveryRequest<RecoveryState>(user, true, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setData(result)
      setDraft(editable(result.draft))
      setDirty(false)
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message)
    })
    return () => controller.abort()
  }, [reloadKey, user])

  useEffect(() => {
    const publication = data?.publication
    if (!publication) return
    const interval = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(interval)
  }, [data?.publication])

  function update(changes: Partial<RecoveryEdition>) {
    setDraft(current => ({ ...current, ...changes }))
    setDirty(true)
    setMessage('')
  }

  function updateLesson(index: number, changes: Partial<RecoveryLesson>) {
    update({ lessons: draft.lessons.map((lesson, at) => at === index ? { ...lesson, ...changes } : lesson) })
  }

  const publication = data?.publication && Date.parse(data.publication.endsAt) > now ? data.publication : null
  const scheduled = publication && Date.parse(publication.startsAt) > now
  const canPublish = data?.publicationAvailable && draft.id > 0 && !dirty &&
    publication?.id !== draft.id && Date.parse(draft.endsAt + ':00-03:00') > now

  async function execute(action: 'save' | 'publish' | 'deactivate') {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const input = action === 'save' ? { ...draft, action, version: draft.id,
        link: draft.link ?? '', lessons: draft.lessons.map(lesson => ({ ...lesson,
          teacher: lesson.teacher ?? '', room: lesson.room ?? '', className: lesson.className ?? '' })) }
        : { action, version: action === 'deactivate' ? publication?.id : draft.id }
      const result = await recoveryRequest<Partial<RecoveryState>>(user, true, undefined, input)
      setNow(Date.now())
      setData(current => current && { ...current, ...result })
      if (result.draft) {
        setDraft(editable(result.draft))
        setDirty(false)
      }
      setMessage(action === 'save' ? 'Rascunho salvo.' : action === 'publish' ? 'Período publicado.' : 'Período desativado.')
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
    if (dirty && !window.confirm('Descartar as alterações locais e atualizar o painel?')) return
    setError('')
    setMessage('')
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
          <h2>{!data.publicationAvailable ? 'Status da publicação indisponível' : scheduled ? 'Período agendado' : publication ? 'Período em andamento' : 'Modo de recuperação desativado'}</h2>
          <button className="portal-control" type="button" disabled={busy} onClick={reload}>Atualizar painel</button>
        </div>
        {publication && <p className="recovery-window">{formatRecoveryTime(publication.startsAt)} até {formatRecoveryTime(publication.endsAt)} · Brasília</p>}
        {publication && publication.id !== draft.id && <p>Há um rascunho mais recente. A Agenda ainda usa a versão publicada.</p>}
        <div className="recovery-actions">
          <button className="portal-control recovery-primary" type="button" disabled={!canPublish || busy}
            onClick={() => void execute('publish')}>Publicar período</button>
          {publication && <button className="portal-control" type="button" disabled={busy}
            onClick={() => void execute('deactivate')}>Desativar período</button>}
        </div>
        {dirty && <p>Salve o rascunho antes de publicar as alterações.</p>}
      </section>
      {error && <p className="interface-panel recovery-panel" role="alert">{error}</p>}
      {message && <p className="interface-panel recovery-panel" role="status">{message}</p>}
      <form className="interface-panel recovery-panel recovery-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend>Rascunho do edital</legend>
          <div className="recovery-fields">
            <label>Início em Brasília<input type="datetime-local" className="portal-control" required value={draft.startsAt} onChange={e => update({ startsAt: e.target.value })} /></label>
            <label>Fim em Brasília<input type="datetime-local" className="portal-control" required value={draft.endsAt} onChange={e => update({ endsAt: e.target.value })} /></label>
            <label className="recovery-wide">Título<input className="portal-control" required maxLength={140} value={draft.title} onChange={e => update({ title: e.target.value })} /></label>
            <label className="recovery-wide">Informações do edital<textarea className="portal-control" rows={5} maxLength={6000} value={draft.description} onChange={e => update({ description: e.target.value })} /></label>
            <label className="recovery-wide">Link do edital<input type="url" className="portal-control" maxLength={1000} placeholder="https://" value={draft.link ?? ''} onChange={e => update({ link: e.target.value })} /></label>
          </div>
          {data.draft?.link && <a className="recovery-action" href={data.draft.link} target="_blank" rel="noreferrer">Abrir link salvo <ExternalLink size={16} /></a>}
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Horários das aulas</legend>
          {draft.lessons.map((lesson, index) => (
            <div className="recovery-lesson" key={index} role="group" aria-label={'Aula ' + (index + 1)}>
              <div className="recovery-fields">
                <label>Matéria<input className="portal-control" required maxLength={120} value={lesson.subject} onChange={e => updateLesson(index, { subject: e.target.value })} /></label>
                <label>Turma<select className="portal-control" value={lesson.className ?? ''} onChange={e => updateLesson(index, { className: e.target.value })}>
                  <option value="">Todas as turmas</option>
                  {lesson.className && !classNames.includes(lesson.className) && <option>{lesson.className}</option>}
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
              <button type="button" className="portal-control recovery-action" onClick={() => update({ lessons: draft.lessons.filter((_, at) => at !== index) })}><Trash2 size={16} /> Remover aula</button>
            </div>
          ))}
          <button type="button" className="portal-control recovery-action" disabled={draft.lessons.length >= 200}
            onClick={() => update({ lessons: [...draft.lessons, { date: draft.startsAt.slice(0, 10), start: '', end: '', subject: '', className: '', teacher: '', room: '' }] })}>
            <Plus size={17} /> Adicionar aula
          </button>
        </fieldset>
        <button type="submit" className="portal-control recovery-primary" disabled={!dirty || busy}>{busy ? 'Aguarde…' : 'Salvar rascunho'}</button>
      </form>
    </div>
  )
}
