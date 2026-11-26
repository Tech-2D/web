import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { classLinkRequest } from './classLink'
import './agendaAccess.css'

type ClassRequest = { uid: string; name: string | null; email: string | null; className: string; requestedClass: string; requestedAt: string }
type Queue = { requests: ClassRequest[]; hasMore: boolean }

export function ClassLinkAdminPanel({ user }: { user: User }) {
  const [queue, setQueue] = useState<Queue>()
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void classLinkRequest<Queue>(user, true, undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setQueue(data)
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message)
    })
    return () => controller.abort()
  }, [user, refresh])

  async function decide(item: ClassRequest, action: 'approve' | 'reject') {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await classLinkRequest(user, true, { action, uid: item.uid, requestedAt: item.requestedAt, requestedClass: item.requestedClass })
      setQueue(current => current && { ...current, requests: current.requests.filter(request => request.uid !== item.uid) })
      setNotice(action === 'approve' ? 'Turma corrigida no perfil.' : 'Pedido recusado.')
      setRefresh(value => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a revisão.')
    } finally { setBusy(false) }
  }

  return <section className="storage-admin" aria-labelledby="class-link-admin-title">
    <div className="storage-admin-heading">
      <div><h3 id="class-link-admin-title">Pedidos de troca de turma</h3><p>Revise os pedidos para corrigir a turma vinculada ao perfil.</p></div>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => { setError(''); setRefresh(value => value + 1) }}>Atualizar</button>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status" className="storage-admin-success">{notice}</p>}
    {!queue && !error && <p role="status">Carregando pedidos…</p>}
    {queue && <div className="storage-admin-list">
      {!queue.requests.length && <p className="admin-empty">Nenhum pedido pendente.</p>}
      {queue.requests.map(item => <article className="storage-admin-file" key={item.uid}>
        <div className="agenda-user-details"><strong>{item.name || item.email || item.uid}</strong>
          {item.name && item.email && <small>{item.email}</small>}
          <span>{item.className} → <strong>{item.requestedClass}</strong></span>
        </div>
        <div className="agenda-user-actions">
          <button type="button" className="primary-button compact" disabled={busy} onClick={() => void decide(item, 'approve')}>Aprovar troca</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => void decide(item, 'reject')}>Recusar</button>
        </div>
      </article>)}
      {queue.hasMore && <p>Mostrando os 100 pedidos mais antigos. Os próximos aparecem conforme você revisa a lista.</p>}
    </div>}
  </section>
}
