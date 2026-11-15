import { useEffect, useState, type FormEvent } from 'react'
import { collection, doc, onSnapshot, query, updateDoc, where } from './dataClient'
import { db } from './firebase'
import type { Feedback } from './types'

export function MyFeedbackCredits({ userId }: { userId: string }) {
  const [items, setItems] = useState<Feedback[]>([])
  const [selected, setSelected] = useState<Feedback | null>(null)
  const [error, setError] = useState('')
  const active = items.find(item => item.id === selected?.id)
  useEffect(() => {
    setItems([]); setSelected(null); setError('')
    return onSnapshot(query(collection(db, 'feedback'), where('createdBy', '==', userId)), snapshot => {
      setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Feedback))
    }, () => setError('Não foi possível carregar suas sugestões.'))
  }, [userId])
  return <div className="feedback-credits"><h3>Minhas sugestões de melhoria</h3>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!items.length && !error && <p>Suas sugestões de melhoria aparecerão aqui depois do envio.</p>}
    {items.map(item => <button className="secondary-button" type="button" key={item.id} onClick={() => setSelected(item)} aria-pressed={selected?.id === item.id}>{item.message.slice(0, 100)}{item.message.length > 100 ? '…' : ''}</button>)}
    {active && <><FeedbackCreditChoice key={active.id} feedback={active} /></>}
  </div>
}

function FeedbackCreditChoice({ feedback }: { feedback: Feedback }) {
  const [allowed, setAllowed] = useState(feedback.publicCreditAllowed === true)
  const [name, setName] = useState(feedback.publicCreditName ?? '')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    if (allowed && (!name.trim() || name.includes('@'))) { setNotice('Escolha um nome público sem e-mail.'); return }
    setBusy(true); setNotice('')
    try {
      await updateDoc(doc(db, 'feedback', feedback.id), { publicCreditAllowed: allowed, publicCreditName: allowed ? name.trim() : '' })
      setNotice('Preferência salva para os próximos avisos. Avisos já publicados não mudam.')
    } catch { setNotice('Não foi possível salvar. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <form className="feedback-public-credit" onSubmit={save}>
    <strong>Crédito público opcional</strong>
    <label><input type="checkbox" checked={allowed} onChange={event => setAllowed(event.target.checked)} /> Autorizo publicar meu nome e o texto desta sugestão em um aviso de atualização.</label>
    {allowed && <label>Nome para o crédito público<input value={name} onChange={event => setName(event.target.value)} maxLength={60} required placeholder="Como você quer aparecer?" /></label>}
    <small>Seu e-mail não aparece no aviso. Desativar vale apenas para avisos futuros.</small>
    <button type="submit" className="secondary-button" disabled={busy}>Salvar preferência</button>
    {notice && <p role="status">{notice}</p>}
  </form>
}
