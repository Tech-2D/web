import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { ArrowLeft, RefreshCw, ShieldBan, ShieldCheck } from 'lucide-react'
import { SQL_BASE } from './dataBackend'
import { auth } from './firebase'

type AgendaAccount = { uid: string; email: string | null; lastVisitDay: string | null; protected: boolean; blocked: boolean; blockId: string | null; blockedUntil: string | null }
type Block = { id: string; label: string; createdAt: string; expiresAt: string }
type UsersResult = { totalUsers?: number | null; matchedUsers?: number | null; users: AgendaAccount[]; hasMore: boolean; blocks: Block[]; hasMoreBlocks: boolean }
type Change = { action: 'block'; kind: 'email' | 'uid'; value: string; durationSeconds: number } | { action: 'unblock'; id: string }
const endpoint = SQL_BASE + '/api/admin/agenda-users'
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const visitDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })

async function request(user: User, path: string, signal: AbortSignal, change?: Change) {
  const token = await user.getIdToken()
  if (auth.currentUser?.uid !== user.uid || signal.aborted) throw Error('Sua sessão mudou.')
  const response = await fetch(endpoint + path, {
    method: change ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(change ? { 'Content-Type': 'application/json' } : {}) },
    ...(change ? { body: JSON.stringify({ ...change, operationId:crypto.randomUUID() }) } : {}),
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
  const [targetKind, setTargetKind] = useState<'email' | 'uid'>('email')
  const [duration, setDuration] = useState(1)
  const [unit, setUnit] = useState(86400)
  const durationSeconds = duration * unit
  const validDuration = Number.isInteger(durationSeconds) && durationSeconds >= 60 && durationSeconds <= 365 * 86400
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

  useEffect(() => {
    if (!result) return
    const expirations = result.blocks.map(block => Date.parse(block.expiresAt))
      .concat(result.users.flatMap(account => account.blockedUntil ? [Date.parse(account.blockedUntil)] : []))
      .filter(Number.isFinite)
    if (!expirations.length) return
    const remaining = Math.min(...expirations) - Date.now() + 1000
    const timer = window.setTimeout(() => refresh(value => value + 1), Math.max(1000, Math.min(remaining, 2147483647)))
    return () => window.clearTimeout(timer)
  }, [result])

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

  function block(kind: 'email' | 'uid', value: string, label = value) {
    if (!validDuration) { setError('Escolha uma duração entre 1 minuto e 365 dias.'); return }
    const end = date.format(new Date(Date.now() + durationSeconds * 1000))
    if (window.confirm('Bloquear o acesso de ' + label + ' até ' + end + '?')) {
      void changeAccess({ action:'block', kind, value, durationSeconds })
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
      {result && <div className="agenda-user-totals" role="status">
        <div><span>Contas cadastradas no sistema</span><strong>{result.totalUsers == null ? '—' : result.totalUsers.toLocaleString('pt-BR')}</strong><small>Total geral, incluindo contas que ainda não acessaram a Agenda.</small></div>
        {query && <div><span>Resultados da busca</span><strong>{result.matchedUsers == null ? '—' : result.matchedUsers.toLocaleString('pt-BR')}</strong><small>O total geral permanece independente do filtro.</small></div>}
      </div>}
      <div className="agenda-users-form">
        <label>Duração do bloqueio<input type="number" min={1} max={Math.floor(365 * 86400 / unit)} step={1} value={duration} onChange={event => setDuration(Number(event.target.value))} /></label>
        <label>Unidade<select value={unit} onChange={event => setUnit(Number(event.target.value))}>
          <option value={60}>Minutos</option><option value={3600}>Horas</option><option value={86400}>Dias</option>
        </select></label>
      </div>
      <p className="storage-admin-note">A duração escolhida vale para os botões abaixo. O acesso é liberado automaticamente ao fim do prazo.</p>
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
                {item.blockedUntil && <small>Bloqueado até {date.format(new Date(item.blockedUntil))}</small>}
              </div>
              <div className="agenda-user-actions">
                {item.protected && <small>Superadministrador</small>}
                {item.blockId && <button type="button" className="secondary-button" disabled={busy} onClick={() => unblock(item.blockId!, item.email || item.uid)}><ShieldCheck size={16} /> Desbloquear conta</button>}
                {!item.protected && !item.blocked && <button type="button" className="secondary-button" disabled={busy || !validDuration} onClick={() => block('uid', item.uid, item.email || item.uid)}>Bloquear conta</button>}
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
        <form className="agenda-users-form" onSubmit={event => { event.preventDefault(); block(targetKind, target.trim()) }}>
          <label>Identificar por<select value={targetKind} onChange={event => { setTargetKind(event.target.value as typeof targetKind); setTarget('') }}><option value="email">E-mail</option><option value="uid">UID da conta</option></select></label>
          <label>{targetKind === 'email' ? 'E-mail da conta' : 'UID da conta'}<input type={targetKind === 'email' ? 'email' : 'text'} value={target} onChange={event => setTarget(event.target.value)} maxLength={targetKind === 'email' ? 254 : 128} required /></label>
          <button className="secondary-button" disabled={busy || !target.trim() || !validDuration}><ShieldBan size={16} /> Bloquear conta</button>
        </form>
        {result && <div className="storage-admin-list">
          {result.blocks.length === 0 && <p className="admin-empty">Nenhum bloqueio nesta página.</p>}
          {result.blocks.map(item => <article className="storage-admin-file" key={item.id}>
            <div className="agenda-user-details"><strong>{item.label}</strong><small>Bloqueado em {date.format(new Date(item.createdAt))}</small><small>Liberação em {date.format(new Date(item.expiresAt))}</small></div>
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
