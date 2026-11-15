import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from './dataClient'
import { LoaderCircle, UserRound } from 'lucide-react'
import { db } from './firebase'
import { filterRepresentatives, type ApprovedRepresentative } from './representatives'

export function RepresentativesPanel() {
  const [items, setItems] = useState<ApprovedRepresentative[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()),60000)
    return () => window.clearInterval(timer)
  },[])
  const visible = useMemo(() => filterRepresentatives(items.filter(item => !item.expiresAt || item.expiresAt.getTime()>now), search), [items, search, now])

  useEffect(() => onSnapshot(collection(db, 'representativeInvites'), snapshot => {
    setItems(snapshot.docs.map(item => {
      const data = item.data()
      return {
        id: item.id,
        email: typeof data.email === 'string' ? data.email : item.id,
        turmaId: typeof data.turmaId === 'string' ? data.turmaId : 'Turma não informada',
        expiresAt: data.expiresAt && typeof data.expiresAt.toDate === 'function' ? data.expiresAt.toDate() : null,
        approvedAt: data.approvedAt && typeof data.approvedAt.toDate === 'function' ? data.approvedAt.toDate() : null,
      }
    }))
    setError('')
    setLoading(false)
  }, () => {
    setItems([])
    setLoading(false)
    setError('Não foi possível carregar os representantes. Confira sua permissão de administrador e tente abrir esta aba novamente.')
  }), [])

  return (
    <section className="representatives-panel" aria-labelledby="approved-representatives-title">
      <div className="admin-list-heading">
        <strong id="approved-representatives-title">Convites de representantes</strong>
        {!loading && !error && <span>{visible.length} convite(s) vigente(s)</span>}
      </div>
      <p className="representative-hint">Cada convite vale por 7 dias após a aprovação. A pessoa deve entrar com o e-mail aprovado e ativar o acesso nesse prazo. Depois da ativação, o papel de representante fica salvo na conta.</p>
      <div className="admin-list-heading">
        <label htmlFor="representatives-search">Buscar por e-mail ou turma</label>
        <input id="representatives-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite o e-mail ou a turma" />
      </div>
      {loading ? <p className="admin-empty" role="status"><LoaderCircle size={18} /> Carregando representantes...</p>
        : error ? <p role="alert">{error}</p>
          : <div className="admin-list">
            {visible.length === 0 ? <p className="admin-empty">{items.length ? 'Nenhum convite corresponde à busca.' : 'Nenhum convite vigente.'}</p>
              : visible.map(item => (
                <article key={item.id} className="admin-row compact representative-row">
                  <div className="avatar"><UserRound /></div>
                  <div className="admin-row-main"><strong>{item.email}</strong><span>{item.turmaId}</span></div>
                  <div className="admin-row-meta"><span>Válido até</span><strong>{item.expiresAt ? item.expiresAt.toLocaleString('pt-BR', {dateStyle:'short',timeStyle:'short'}) : 'Não informado'}</strong></div>
                </article>
              ))}
          </div>}
    </section>
  )
}
