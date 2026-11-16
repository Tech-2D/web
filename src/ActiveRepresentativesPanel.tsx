import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { LoaderCircle, UserRound } from 'lucide-react'
import { SQL_BASE } from './dataBackend'
import { auth } from './firebase'
import { filterRepresentatives } from './representatives'

type Representative = { uid: string; email: string | null; turmaId: string | null; activatedAt: string | null }
type Result = { representatives: Representative[]; directoryUnavailable: boolean }
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function ActiveRepresentativesPanel({ user }: { user: User }) {
  const [result, setResult] = useState<Result | null>(null)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const token = await user.getIdToken()
        if (auth.currentUser?.uid !== user.uid || controller.signal.aborted) return
        const response = await fetch(SQL_BASE + '/api/admin/agenda-users?view=representatives', {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        })
        if (!response.ok) throw Error('REPRESENTATIVES_UNAVAILABLE')
        const data = await response.json() as Result
        if (!controller.signal.aborted && auth.currentUser?.uid === user.uid) setResult(data)
      } catch {
        if (!controller.signal.aborted && auth.currentUser?.uid === user.uid) setFailed(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [user])

  const visible = filterRepresentatives((result?.representatives ?? []).map(row => ({
    ...row,
    email: row.email ?? row.uid,
    turmaId: row.turmaId ?? 'Turma não informada',
  })), search)

  return (
    <section className="representatives-panel" aria-labelledby="active-representatives-title">
      <div className="admin-list-heading">
        <strong id="active-representatives-title">Representantes ativos</strong>
        {result && <span>{visible.length} de {result.representatives.length}</span>}
      </div>
      {failed ? <p role="alert">Não foi possível carregar os representantes ativos. Reabra a aba para tentar novamente.</p>
        : !result ? <p className="admin-empty" role="status"><LoaderCircle size={18} /> Carregando representantes ativos...</p>
        : <>
          {result.directoryUnavailable && <p role="status">Alguns e-mails estão indisponíveis. O identificador da conta aparece nesses casos.</p>}
          <div className="admin-list-heading">
            <label htmlFor="active-representatives-search">Buscar por e-mail ou turma</label>
            <input id="active-representatives-search" type="search" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <div className="admin-list">
            {visible.length === 0 && <p className="admin-empty">{result.representatives.length ? 'Nenhum representante corresponde à busca.' : 'Nenhum representante ativo.'}</p>}
            {visible.map(item => (
              <article key={item.uid} className="admin-row compact representative-row">
                <div className="avatar"><UserRound /></div>
                <div className="admin-row-main"><strong>{item.email}</strong><span>{item.turmaId}</span></div>
                <div className="admin-row-meta">
                  <span>Ativado em</span>
                  <strong>{item.activatedAt && Number.isFinite(Date.parse(item.activatedAt)) ? dateFormat.format(new Date(item.activatedAt)) : '—'}</strong>
                </div>
              </article>
            ))}
          </div>
        </>}
    </section>
  )
}
