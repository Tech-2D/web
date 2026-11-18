import { useEffect, useRef, useState, type FormEvent } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { API_BASE } from './apiBase'
import { auth } from './firebase'
import './agendaAccess.css'

type Administrator = { uid: string; email: string | null }
type Result = { administrators: Administrator[]; directoryUnavailable: boolean }

async function request(user: User, body?: { email: string; operationId: string }, signal?: AbortSignal) {
  const token = await user.getIdToken(Boolean(body))
  if (auth.currentUser?.uid !== user.uid || signal?.aborted) throw Error('Sua sessão mudou. Entre novamente.')
  const response = await fetch(API_BASE + '/api/admin/administrators', {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
    cache: 'no-store', redirect: 'error',
  })
  const data = await response.json()
  if (auth.currentUser?.uid !== user.uid || signal?.aborted) throw Error('Sua sessão mudou. Entre novamente.')
  if (!response.ok) throw Error(data.message || 'Não foi possível acessar os administradores.')
  return data
}

export function AdministratorsPanel({ user }: { user: User }) {
  const [result, setResult] = useState<Result | null>(null)
  const [revision, refresh] = useState(0)
  const [email, setEmail] = useState('')
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const operation = useRef<{ email: string; id: string } | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    void request(user, undefined, controller.signal).then(setResult).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os administradores.')
    })
    return () => controller.abort()
  }, [user, revision])

  function prepare(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    setPassword('')
    setConfirmation(email.trim().toLowerCase())
  }

  async function grant(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || !confirmation || !user.email) return
    submitting.current = true
    setBusy(true)
    setError('')
    const enteredPassword = password
    setPassword('')
    try {
      if (auth.currentUser?.uid !== user.uid) throw Error('Sua sessão mudou. Entre novamente.')
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, enteredPassword))
      if (auth.currentUser?.uid !== user.uid) throw Error('Sua sessão mudou. Entre novamente.')
      if (operation.current?.email !== confirmation) operation.current = { email: confirmation, id: crypto.randomUUID() }
      const response = await request(user, { email: confirmation, operationId: operation.current.id })
      setNotice(response.alreadyAdmin ? confirmation + ' já é administrador.' : 'Acesso de administrador concedido para ' + confirmation + '.')
      setConfirmation(null)
      setEmail('')
      operation.current = null
      refresh(value => value + 1)
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
      setError(code === 'auth/too-many-requests' ? 'Muitas tentativas. Aguarde antes de confirmar sua senha novamente.'
        : code.startsWith('auth/') ? 'Não foi possível confirmar sua senha. Confira e tente novamente.'
          : cause instanceof Error ? cause.message : 'Não foi possível conceder o acesso.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <section className="storage-admin" aria-labelledby="administrators-title">
    <div className="storage-admin-heading">
      <div><h3 id="administrators-title">Administradores</h3><p>Administradores podem gerenciar todas as turmas, usuários e configurações do portal, além de conceder acesso a outras pessoas.</p></div>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => { setError(''); refresh(value => value + 1) }}><RefreshCw size={16} />Atualizar</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="storage-admin-success" role="status">{notice}</p>}
    {confirmation ? <form className="storage-admin" onSubmit={grant} aria-label="Confirmar acesso de administrador">
      <p>Conceder acesso completo de administrador a <strong>{confirmation}</strong>?</p>
      <div className="agenda-users-form">
        <label>Sua senha<input type="password" autoComplete="current-password" autoFocus required maxLength={128} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button className="primary-button" disabled={busy || !password}>{busy ? 'Confirmando…' : 'Confirmar e conceder acesso'}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => { setConfirmation(null); setPassword(''); setError('') }}>Cancelar</button>
      </div>
    </form> : <form className="agenda-users-form" onSubmit={prepare}>
      <label>E-mail da pessoa<input type="email" autoComplete="off" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="E-mail de uma conta já cadastrada" /></label>
      <button className="primary-button" disabled={busy || !user.email}>Adicionar administrador</button>
    </form>}
    {!result && !error && <p role="status">Carregando administradores…</p>}
    {result?.directoryUnavailable && <p role="status">Alguns e-mails estão indisponíveis. O identificador da conta aparece nesses casos.</p>}
    {result && <div className="storage-admin-list">
      <div className="admin-list-heading"><strong>Administradores atuais</strong><span>{result.administrators.length}</span></div>
      {result.administrators.map(item => <article key={item.uid} className="storage-admin-file">
        <div className="agenda-user-details"><strong>{item.email ?? item.uid}</strong><small>{item.uid === user.uid ? 'Sua conta' : 'Administrador'}</small></div>
        <ShieldCheck size={20} aria-hidden="true" />
      </article>)}
    </div>}
  </section>
}
