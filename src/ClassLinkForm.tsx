import { useState, type FormEvent } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import type { User } from 'firebase/auth'
import { classLinkRequest, type ClassCatalog, type ClassStatus } from './classLink'

const dayFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function ClassLinkForm({ user, data, onSave, onMissingClass }: {
  user: User; data: ClassCatalog; onSave: (status: ClassStatus) => void; onMissingClass?: () => void
}) {
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const available = data.canChange || (data.availableAt != null && Date.parse(data.availableAt) <= Date.now())
  const requesting = !!data.link && !available

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy || !selected) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await classLinkRequest<ClassStatus>(user, false, {
        action: requesting ? 'request' : 'save', className: selected,
      })
      onSave(result)
      setSelected('')
      setNotice(requesting ? 'Pedido enviado à administração.' : 'Turma salva no seu perfil.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a turma.')
    } finally {
      setBusy(false)
    }
  }

  return <form className={onMissingClass ? 'class-link-form class-setup-form' : 'portal-tool-row class-link-form'} onSubmit={save} aria-busy={busy}>
    {requesting && data.availableAt && <p>Você pode trocar por conta própria a partir de {dayFormat.format(new Date(data.availableAt))}. Antes disso, envie um pedido à administração.</p>}
    {data.link?.requestedClass && <p role="status">Aguardando análise do pedido para <strong>{data.link.requestedClass}</strong>.</p>}
    <label>{data.link ? 'Nova turma' : 'Sua turma'}<select className="portal-control" required value={selected}
      onChange={event => setSelected(event.target.value)} disabled={busy}>
      <option value="" disabled>Selecione uma turma</option>
      {data.classes.filter(name => name !== data.link?.className).map(name => <option key={name}>{name}</option>)}
    </select></label>
    {onMissingClass && <button type="button" className="class-setup-help" onClick={onMissingClass} disabled={busy}>Minha turma não aparece</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="primary-button compact" disabled={!selected || busy || (requesting && selected === data.link?.requestedClass)}>
      {busy ? 'Salvando…' : requesting ? 'Solicitar correção' : onMissingClass ? 'Confirmar e abrir Agenda' : 'Salvar turma'}
      {onMissingClass && (busy ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />)}
    </button>
    {notice && <p role="status">{notice}</p>}
  </form>
}
