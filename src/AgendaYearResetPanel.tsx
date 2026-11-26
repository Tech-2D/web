import { useEffect, useRef, useState, type FormEvent } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth'
import { RotateCcw, Trash2 } from 'lucide-react'
import { auth } from './firebase'
import { API_BASE } from './apiBase'
import './agendaAccess.css'

const confirmation = 'LIMPAR AGENDA'
const labels = {
  activities: 'Atividades',
  recurrences: 'Regras de repetição',
  attachments: 'Anexos vinculados',
  representatives: 'Representantes',
} as const
type Counts = Record<keyof typeof labels, number>
type Preview = { counts: Counts; revision: string; readOnly: boolean }
type Command = { confirmation: string; revision: string; operationId: string }
const number = new Intl.NumberFormat('pt-BR')

async function request<T>(user: User, signal: AbortSignal, body?: Command): Promise<T> {
  const token = await user.getIdToken(Boolean(body))
  if (auth.currentUser?.uid !== user.uid || signal.aborted) throw Error('Sua sessão mudou. Entre novamente.')
  const response = await fetch(API_BASE + '/api/admin/agenda-year-reset', {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.any([signal, AbortSignal.timeout(body ? 45000 : 15000)]),
    cache: 'no-store', redirect: 'error',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw Error(data?.message || 'Não foi possível acessar a limpeza da Agenda.')
  return data
}

export function AgendaYearResetPanel({ user }: { user: User }) {
  const [preview, setPreview] = useState<Preview>()
  const [refresh, setRefresh] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const operation = useRef<string | undefined>(undefined)
  const submitting = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    void request<Preview>(user, controller.signal).then(result => {
      if (!controller.signal.aborted) setPreview(result)
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a prévia.')
    })
    return () => controller.abort()
  }, [user, refresh])

  function clearConfirmation() {
    setExpanded(false)
    setPhrase('')
    setPassword('')
  }

  function loadPreview() {
    clearConfirmation()
    setError('')
    setPreview(undefined)
    operation.current = undefined
    setRefresh(value => value + 1)
  }

  async function execute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || !user.email || !preview || preview.readOnly || phrase !== confirmation || !password) return
    submitting.current = true
    setBusy(true)
    setError('')
    const enteredPassword = password
    setPassword('')
    try {
      if (auth.currentUser?.uid !== user.uid) throw Error('Sua sessão mudou. Entre novamente.')
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, enteredPassword))
      operation.current ??= crypto.randomUUID()
      const { counts } = await request<{ counts: Counts }>(user, AbortSignal.timeout(50000), {
        confirmation, revision: preview.revision, operationId: operation.current,
      })
      setMessage(`Limpeza registrada. ${number.format(counts.activities)} atividades e ${number.format(counts.recurrences)} regras de repetição removidas. ${number.format(counts.representatives)} acessos de representante revogados e ${number.format(counts.attachments)} anexos encaminhados para exclusão.`)
      loadPreview()
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
      setError(code.startsWith('auth/') ? 'Não foi possível confirmar sua senha. Confira e tente novamente.'
        : cause instanceof Error ? cause.message : 'Não foi possível confirmar a limpeza. Confira a prévia.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <section className="storage-admin" aria-labelledby="year-reset-title">
    <div className="storage-admin-heading">
      <div>
        <h3 id="year-reset-title">Limpeza de virada de ano</h3>
        <p>Revise o que será excluído de todas as turmas. A exclusão é definitiva.</p>
      </div>
      <button type="button" className="secondary-button" disabled={busy} onClick={loadPreview}><RotateCcw size={16} /> Atualizar prévia</button>
    </div>
    {message && <p className="storage-admin-success" role="status">{message}</p>}
    {!preview && !error && <p role="status">Preparando prévia…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {preview && <>
      <dl className="account-analysis-facts">
        {(Object.keys(labels) as (keyof Counts)[]).map(key => (
          <div key={key}><dt>{labels[key]}</dt><dd><strong>{number.format(preview.counts[key])}</strong></dd></div>
        ))}
      </dl>
      <p>Os representantes voltam a usar o portal como usuários comuns. Convites de representação anteriores à limpeza perdem a validade.</p>
      <p className="storage-admin-note">Contas, administradores, turmas, horários de professores, Notas e Kanban ficam preservados.</p>
      {preview.readOnly ? <p role="status">A Agenda está em manutenção. A limpeza pode ser feita quando as gravações voltarem.</p> :
        expanded ? <form className="agenda-users-form" onSubmit={execute} aria-label="Confirmar limpeza da Agenda">
          <label>Digite <strong>{confirmation}</strong><input value={phrase} onChange={event => setPhrase(event.target.value)}
            required autoComplete="off" disabled={busy} maxLength={40} /></label>
          <label>Sua senha<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}
            required disabled={busy} /></label>
          <button className="primary-button" disabled={busy || !user.email || phrase !== confirmation || !password}>
            <Trash2 size={16} /> {busy ? 'Executando…' : 'Confirmar limpeza definitiva'}
          </button>
          <button type="button" className="secondary-button" disabled={busy} onClick={clearConfirmation}>Cancelar</button>
        </form> : <button type="button" className="secondary-button" disabled={!user.email} onClick={() => {
          setMessage(''); setExpanded(true)
        }}><Trash2 size={16} /> Preparar limpeza</button>}
    </>}
  </section>
}
