import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { ArrowLeft, RefreshCw, ShieldBan, ShieldCheck } from 'lucide-react'
import { SQL_BASE } from './dataBackend'
import { auth } from './firebase'

type AgendaAccount = { uid: string; email: string | null; lastVisitDay: string | null; protected: boolean; emailBlocked: boolean; emailBlockId?: string | null }
type Block = { id: string; label: string; createdAt: string }
type UsersResult = { users: AgendaAccount[]; hasMore: boolean; blocks: Block[]; hasMoreBlocks: boolean }
type Change = { action: 'block'; kind: 'email'; value: string } | { action: 'unblock'; id: string }
const endpoint = SQL_BASE + '/api/admin/agenda-users'
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const visitDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })

async function request(user: User, path: string, signal: AbortSignal, change?: Change) {
  const token = await user.getIdToken()
  if (auth.currentUser?.uid !== user.uid || signal.aborted) throw Error('Sua sessão mudou.')
  const response = await fetch(endpoint + path, {
    method: change ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(change ? { 'Content-Type': 'application/json' } : {}) },
    ...(change ? { body: JSON.stringify(change) } : {}),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  const result = await response.json().catch(() => null)
  if (auth.currentUser?.uid !== user.uid || signal.aborted) throw Error('Sua sessão mudou.')
  if (!response.ok) throw Error(result?.message || 'Não foi possível consultar a Agenda.')
  return result
}

export function AgendaUsersPanel({ user }: { user: User }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [blockOffset, setBlockOffset] = useState(0)
  const [revision, refresh] = useState(0)
  const [result, setResult] = useState<UsersResult | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState('')
  const usersHeading = useRef<HTMLHeadingElement>(null)
  const blocksHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setError('')
    const params = new URLSearchParams({ q: query, offset: String(offset), blockOffset: String(blockOffset) })
    void request(user, '?' + params, controller.signal).then(data => setResult(data as UsersResult)).catch(cause => {
      if (!controller.signal.aborted && auth.currentUser?.uid === user.uid) setError(cause instanceof Error ? cause.message : 'Falha ao carregar usuários.')
    })
    return () => controller.abort()
  }, [user, query, offset, blockOffset, revision])

  async function changeAccess(change: Change) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(user, '', AbortSignal.timeout(15000), change)
      setNotice(change.action === 'block' ? 'Bloqueio registrado.' : 'Bloqueio removido.')
      setTarget('')
      setBlockOffset(0)
      refresh(n => n + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao alterar o acesso.')
    } finally {
      setBusy(false)
    }
  }

  function block(email: string) {
    if (window.confirm('Bloquear o acesso com esse e-mail?\n\n' + email)) {
      void changeAccess({ action: 'block', kind: 'email', value: email })
    }
  }

  function unblock(id: string, label: string) {
    if (window.confirm('Remover o bloqueio de ' + label + '?')) void changeAccess({ action: 'unblock', id })
  }

  function searchUsers(event: FormEvent) {
    event.preventDefault()
    setOffset(0)
    setQuery(search.trim())
  }

  return (
    <section className="storage-admin agenda-users" aria-labelledby="agenda-users-title">
      <div className="storage-admin-heading">
        <div><h3 id="agenda-users-title" tabIndex={-1} ref={usersHeading}>Usuários e bloqueios</h3><p>Consulte as contas cadastradas, a data da última visita à Agenda e os bloqueios ativos.</p></div>
        <div className="agenda-user-actions">
          <button type="button" className="secondary-button" onClick={() => blocksHeading.current?.focus()}><ShieldBan size={16} /> Ver bloqueios ativos</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => refresh(n => n + 1)}><RefreshCw size={16} /> Atualizar</button>
        </div>
      </div>
      {notice && <p className="storage-admin-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <form className="agenda-users-form" onSubmit={searchUsers}>
        <label>Buscar conta<input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={254} placeholder="E-mail ou UID" /></label>
        <button className="secondary-button" disabled={busy}>Buscar</button>
      </form>
      {!result && !error && <p role="status">Carregando usuários…</p>}
      {result && <>
        <div className="storage-admin-list">
          {result.users.length === 0 && <p className="admin-empty">Nenhuma conta encontrada.</p>}
          {result.users.map(item => (
            <article className="storage-admin-file" key={item.uid}>
              <div className="agenda-user-details">
                <strong>{item.email || 'Conta sem e-mail registrado'}</strong>
                <small>UID {item.uid}</small>
                <small>{item.lastVisitDay ? <>Última visita em <time dateTime={item.lastVisitDay}>{visitDate.format(new Date(item.lastVisitDay))}</time></> : 'Sem visita registrada na Agenda'}</small>
                {item.emailBlocked && <small>E-mail bloqueado</small>}
              </div>
              <div className="agenda-user-actions">
                {item.protected && <small>Superadministrador</small>}
                {item.emailBlockId && <button type="button" className="secondary-button" disabled={busy} onClick={() => unblock(item.emailBlockId!, item.email || 'e-mail desta conta')}><ShieldCheck size={16} /> Desbloquear e-mail</button>}
                {!item.protected && item.email && !item.emailBlocked && <button type="button" className="secondary-button" disabled={busy} onClick={() => block(item.email!)}>Bloquear e-mail</button>}
              </div>
            </article>
          ))}
        </div>
        {(offset > 0 || result.hasMore) && <nav className="agenda-user-actions" aria-label="Páginas de usuários">
          <button type="button" className="secondary-button" disabled={offset === 0 || busy} onClick={() => setOffset(n => n - 50)}>Anterior</button>
          <button type="button" className="secondary-button" disabled={!result.hasMore || busy} onClick={() => setOffset(n => n + 50)}>Próxima</button>
        </nav>}
      </>}
      <section className="agenda-users-blocks" aria-labelledby="agenda-blocks-title">
        <div className="storage-admin-heading">
          <h4 id="agenda-blocks-title" tabIndex={-1} ref={blocksHeading}>Bloqueios ativos</h4>
          <button type="button" className="secondary-button" onClick={() => usersHeading.current?.focus()}><ArrowLeft size={16} /> Voltar aos usuários</button>
        </div>
        <form className="agenda-users-form" onSubmit={event => { event.preventDefault(); block(target.trim()) }}>
          <label>E-mail da conta<input type="email" value={target} onChange={event => setTarget(event.target.value)} maxLength={254} required /></label>
          <button className="secondary-button" disabled={busy || !target.trim()}><ShieldBan size={16} /> Bloquear e-mail</button>
        </form>
        {result && <div className="storage-admin-list">
          {result.blocks.length === 0 && <p className="admin-empty">Nenhum bloqueio nesta página.</p>}
          {result.blocks.map(item => <article className="storage-admin-file" key={item.id}>
            <div className="agenda-user-details"><strong>{item.label}</strong><small>Bloqueado em {date.format(new Date(item.createdAt))}</small></div>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => unblock(item.id, item.label)}><ShieldCheck size={16} /> Desbloquear</button>
          </article>)}
        </div>}
        {result && (blockOffset > 0 || result.hasMoreBlocks) && <nav className="agenda-user-actions" aria-label="Páginas de bloqueios">
          <button type="button" className="secondary-button" disabled={blockOffset === 0 || busy} onClick={() => setBlockOffset(n => n - 50)}>Anterior</button>
          <button type="button" className="secondary-button" disabled={!result.hasMoreBlocks || busy} onClick={() => setBlockOffset(n => n + 50)}>Próxima</button>
        </nav>}
      </section>
    </section>
  )
}
