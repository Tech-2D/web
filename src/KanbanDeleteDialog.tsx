import { useEffect, useId, useRef, useState } from 'react'

export function KanbanDeleteDialog({ titles, shared, disabled, onCancel, onConfirm }: {
  titles: string[]
  shared: boolean
  disabled: boolean
  onCancel: () => void
  onConfirm: () => Promise<boolean | void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const saving = useRef(false)
  const titleId = useId()
  const descriptionId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function confirm() {
    if (disabled || saving.current) return
    saving.current = true
    setBusy(true)
    setError(false)
    try {
      if (await onConfirm() === false) setError(true)
      else onCancel()
    } catch {
      setError(true)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return <dialog ref={dialog} className="kb-card-delete-dialog"
    aria-labelledby={titleId} aria-describedby={descriptionId}
    onKeyDown={event => event.stopPropagation()}
    onCancel={event => {
      event.preventDefault()
      if (!saving.current) onCancel()
    }}>
    <h2 id={titleId}>{titles.length === 1 ? 'Excluir cartão?' : 'Excluir ' + titles.length + ' cartões?'}</h2>
    <p id={descriptionId}>
      {titles.length === 1 ? '“' + titles[0] + '” será excluído' : 'Os cartões selecionados serão excluídos'}
      {shared ? ' para todos os participantes.' : ' deste quadro.'}
    </p>
    {error && <p className="kb-error" role="alert">A exclusão não foi enviada. Confira o quadro e tente novamente.</p>}
    <div className="kb-card-delete-actions">
      <button type="button" className="secondary-button" autoFocus disabled={busy} onClick={onCancel}>Cancelar</button>
      <button type="button" className="kb-delete" disabled={busy || disabled} onClick={() => void confirm()}>
        {busy ? 'Excluindo…' : 'Excluir'}
      </button>
    </div>
  </dialog>
}

