import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, ChevronDown, Maximize2, MessageCircle, Minimize2, Plus, Sparkles, X } from 'lucide-react'
import type { User } from 'firebase/auth'
import { KanbanCardFace } from './KanbanCardFace'
import { PRIORITIES } from './kanban'
import type { Activity, AssistantActivityReference, Batch, BatchInput, CardInput, Draft, Fields, Kanban } from './assistantContract'
import { useAssistantTransport, type AssistantRoute } from './useAssistantTransport'
export type { AssistantActivityReference } from './assistantContract'
import { ACTIVITY_TYPE_COLORS, type ActivityType } from './types'
import { canCreateActivityCard } from './activityFuture'
import { sitePaths } from './sitePaths'
import './kanban.css'
import './assistantChat.css'

type Turn = { text: string; user?: boolean; cards?: Activity[] }

const examples = ['Qual a próxima prova?', 'Cria um card falando para estudar matemática', 'Onde tá a Lisete?']
const kanbanDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' })

export default function AssistantChat({ account, preferredClass, endpoint, prefill, covered, onViewKanban, agendaPath = sitePaths.agenda }: {
  account: User; preferredClass: string | null; endpoint: string; prefill?: AssistantActivityReference | null; covered?: boolean
  onViewKanban?: () => void
  agendaPath?: string
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [message, setMessage] = useState('')
  const [linkedActivity, setLinkedActivity] = useState<AssistantActivityReference | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [kanban, setKanban] = useState<Kanban | null>(null)
  const [submission, setSubmission] = useState<{ id: string; fields: CardInput } | null>(null)
  const [batchSubmission, setBatchSubmission] = useState<{ id: string; items: BatchInput[] } | null>(null)
  const [retryOnly, setRetryOnly] = useState(false)
  const [retryMessage, setRetryMessage] = useState<Record<string, unknown> | null>(null)
  const [quotaText, setQuotaText] = useState('')
  const transport = useAssistantTransport(account, endpoint)
  const request = transport.inFlight
  const chat = useRef<HTMLDivElement>(null)
  const transcript = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [turns, kanban, open])
  useLayoutEffect(() => {
    if (input.current) fitMessageInput(input.current)
  }, [message, open, expanded, covered])
  useEffect(() => {
    const field = input.current
    if (!field) return
    const fit = () => fitMessageInput(field)
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [open])
  useEffect(() => {
    const root = chat.current
    const viewport = window.visualViewport
    if (!root || !open || covered || !viewport || !window.matchMedia('(any-pointer: coarse)').matches) return

    let frame = 0
    const resetViewport = () => {
      root.removeAttribute('data-keyboard')
      root.style.removeProperty('--chat-visible-height')
      root.style.removeProperty('--chat-viewport-bottom')
    }
    const updateViewport = () => {
      if (viewport.scale !== 1 || window.innerHeight - viewport.height < 96) {
        resetViewport()
        return
      }
      root.setAttribute('data-keyboard', '')
      root.style.setProperty('--chat-visible-height', `${viewport.height}px`)
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty('--chat-viewport-bottom', `${bottom}px`)
      const scrollArea = transcript.current
      const focused = document.activeElement
      // Keep a card field visible when the keyboard reduces the transcript area.
      if (scrollArea && focused instanceof HTMLElement && scrollArea.contains(focused)) {
        const area = scrollArea.getBoundingClientRect()
        const field = focused.getBoundingClientRect()
        if (field.bottom > area.bottom) scrollArea.scrollTop += field.bottom - area.bottom + 8
        else if (field.top < area.top) scrollArea.scrollTop += field.top - area.top - 8
      }
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateViewport)
    }
    updateViewport()
    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
      resetViewport()
    }
  }, [open, covered])
  useEffect(() => {
    if (!prefill) return
    setLinkedActivity(prefill)
    setMessage(cardPrompt(prefill))
    setOpen(true)
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [prefill])

  async function send(path: AssistantRoute, body: Record<string, unknown>, userText?: string) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    const payload = path === '/api/chat' && !body.request_id ? { ...body, request_id: crypto.randomUUID() } : body
    setBusy(true)
    setError('')
    setRetryMessage(null)
    if (userText) setTurns(old => [...old, { text: userText, user: true }])
    try {
      const response = await transport.send(path, payload, controller.signal)
      if (controller.signal.aborted) return
      if (!response.ok) {
        const { data } = response
        if (data.code === 'daily_quota') setQuotaText('0 mensagens restantes hoje')
        if (path === '/api/chat' && (response.status >= 500 || response.status === 429 && data.code !== 'daily_quota')) {
          setRetryMessage(payload)
        }
        if (path === '/api/kanban' || data.operation === 'kanban_confirmation') {
          if (response.status === 404 || response.status === 409) {
            setKanban(null)
            setRetryOnly(false)
          } else if (body.action === 'create' || data.operation === 'kanban_confirmation') {
            if (response.status >= 500) setRetryOnly(true)
            else if (response.status === 422) setRetryOnly(false)
          }
        }
        setError(data.detail ?? 'Confira os dados e tente novamente.')
        return
      }
      const { data } = response
      if (path === '/api/chat') {
        setQuotaText(data.unlimited_messages
          ? 'Sem limite diário'
          : typeof data.remaining_messages === 'number'
            ? `${data.remaining_messages} mensagens restantes hoje`
            : '')
      }
      setTurns(old => [...old, { text: data.answer, cards: data.cards }])
      if (path === '/api/kanban' || data.kanban) {
        setKanban(data.kanban ?? null)
        setRetryOnly((data.kanban?.state === 'draft' || data.kanban?.state === 'batch') && !!data.kanban.retry_only)
        if (data.kanban?.state !== 'draft') setSubmission(null)
        if (data.kanban?.state !== 'batch') setBatchSubmission(null)
      }
    } catch {
      if (!controller.signal.aborted) {
        if (body.action === 'create') setRetryOnly(true)
        if (path === '/api/chat') setRetryMessage(payload)
        setError('Não consegui confirmar a resposta. Tente novamente.')
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        if (!controller.signal.aborted) setBusy(false)
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!message.trim() || request.current) return
    const text = message.trim()
    const draft = kanban?.state === 'draft'
      ? { draft_id: kanban.id, fields: submission?.id === kanban.id ? submission.fields : initialCardInput(kanban) }
      : kanban?.state === 'batch'
        ? { draft_id: kanban.id, items: batchSubmission?.id === kanban.id
          ? batchSubmission.items
          : kanban.drafts.map(item => ({ ...initialCardInput(item), draft_id: item.id })) }
        : undefined
    const activityId = linkedActivity?.id
    setMessage('')
    setLinkedActivity(null)
    void send('/api/chat', {
      message: text, preferred_class: preferredClass, ...(activityId ? { activity_id: activityId } : {}), draft,
    }, text)
  }
  function act(action: 'create' | 'cancel', fields?: CardInput) {
    if (request.current || kanban?.state !== 'draft') return
    if (fields) setSubmission({ id: kanban.id, fields })
    void send('/api/kanban', { action, draft_id: kanban.id, confirmation_source: 'button', ...(fields ? { fields } : {}) })
  }
  function actBatch(action: 'create' | 'cancel', items?: BatchInput[]) {
    if (request.current || kanban?.state !== 'batch') return
    if (items) setBatchSubmission({ id: kanban.id, items })
    void send('/api/kanban', { action, draft_id: kanban.id, confirmation_source: 'button', ...(items ? { items } : {}) })
  }
  function close() {
    setOpen(false)
    requestAnimationFrame(() => toggle.current?.focus())
  }
  function startNewChat() {
    if (request.current) return
    transport.forget()
    setTurns([])
    setMessage('')
    setLinkedActivity(null)
    setError('')
    setKanban(null)
    setSubmission(null)
    setBatchSubmission(null)
    setRetryOnly(false)
    setRetryMessage(null)
    requestAnimationFrame(() => input.current?.focus())
  }
  function prepareFromResult(activity: Activity) {
    if (!activity.id) return
    setLinkedActivity({ ...activity, id: activity.id })
    setMessage(cardPrompt(activity))
    input.current?.focus()
  }
  const sizeAction = expanded ? 'Restaurar tamanho do chat' : 'Ampliar chat'

  return <div ref={chat} className="agenda-assistant" hidden={covered} data-expanded={open && expanded ? 'true' : undefined}>
    <button ref={toggle} className="agenda-assistant-toggle primary-button compact" type="button" aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>
      <MessageCircle size={20} aria-hidden="true" /> Assistente
    </button>
    {open && <section className="agenda-assistant-panel" aria-label="Assistente" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <header>
        <strong>Assistente</strong>
        <div className="agenda-assistant-controls">
          <button type="button" className="assistant-new-chat" aria-label="Nova conversa" title="Nova conversa" disabled={busy} onClick={startNewChat}>
            <Plus size={16} aria-hidden="true" /> <span>Novo chat</span>
          </button>
          <button type="button" className="kb-icon" aria-label={sizeAction} title={sizeAction} onClick={() => setExpanded(value => !value)}>
            {expanded ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
          </button>
          <button type="button" className="kb-icon" aria-label="Fechar assistente" onClick={close}><X size={20} aria-hidden="true" /></button>
        </div>
      </header>
      <div ref={transcript} className="agenda-assistant-turns" role="log" aria-live="polite">
        {turns.length === 0 && <div className="assistant-welcome">
          <div className="assistant-turn">Oi! Posso ajudar você com ações rápidas do sistema. Experimente perguntar:</div>
          <div className="assistant-examples">{examples.map(example => <button type="button" key={example} disabled={busy} onClick={() => {
            setMessage('')
            setLinkedActivity(null)
            void send('/api/chat', { message: example, preferred_class: preferredClass }, example)
          }}>{example}</button>)}</div>
        </div>}
        {turns.map((turn, index) => <div className={turn.cards?.length ? 'assistant-result-turn' : 'assistant-message'} key={index}>
          <div className={turn.user ? 'assistant-turn user' : 'assistant-turn'}>{turn.text}</div>
          {!!turn.cards?.length && <div className="assistant-result-list">
            {turn.cards.map((card, index) => <ActivityResult key={card.id ?? index} activity={card}
              agendaPath={agendaPath} onOpen={() => setOpen(false)} onPrepare={() => prepareFromResult(card)} />)}
          </div>}
        </div>)}
        {kanban?.state === 'draft' && <DraftCard key={kanban.id} draft={kanban} busy={busy} retryOnly={retryOnly}
          submitted={submission?.id === kanban.id ? submission.fields : null} onFieldsChange={fields => setSubmission({ id: kanban.id, fields })} onAction={act} />}
        {kanban?.state === 'batch' && <DraftBatch key={kanban.id} batch={kanban} busy={busy} retryOnly={retryOnly}
          submitted={batchSubmission?.id === kanban.id ? batchSubmission.items : null}
          onFieldsChange={items => setBatchSubmission({ id: kanban.id, items })} onAction={actBatch} />}
        {kanban?.state === 'saved' && <CardPreview key={kanban.task.id} label="Card criado" title={kanban.task.title} collapsible={false}>
          <small>{kanban.board.name} / {kanban.column.name}</small>
          <article className="kb-card"><KanbanCardFace task={kanban.task} column={kanban.column} assignees={[]} /></article>
          <a href={agendaPath + '#kanban'} onClick={() => { close(); onViewKanban?.() }}>Ver no Kanban</a>
        </CardPreview>}
        {kanban?.state === 'batch_saved' && <div className="assistant-batch">
          {kanban.cards.map(card => <CardPreview key={card.task.id} label="Card criado" title={card.task.title} collapsible={false}>
            <small>{card.board.name} / {card.column.name}</small>
            <article className="kb-card"><KanbanCardFace task={card.task} column={card.column} assignees={[]} /></article>
          </CardPreview>)}
          <a href={agendaPath + '#kanban'} onClick={() => { close(); onViewKanban?.() }}>Ver no Kanban</a>
        </div>}
        {kanban?.state === 'missing' && <a href={agendaPath + '#kanban'} onClick={close}>Abrir Kanban</a>}
        {busy && <p role="status">Aguarde…</p>}
        {error && <p className="kb-error" role="alert">{error}</p>}
        {retryMessage && <button type="button" className="kb-link" disabled={busy}
          onClick={() => void send('/api/chat', retryMessage)}>Reenviar mensagem</button>}
      </div>
      <form className="agenda-assistant-compose" onSubmit={submit}>
        {linkedActivity && <div className="assistant-compose-reference">
          <Sparkles size={15} aria-hidden="true" />
          <span>Atividade vinculada · {linkedActivity.title}</span>
          <button className="kb-icon" type="button" aria-label="Remover vínculo com a atividade"
            onClick={() => {
              setLinkedActivity(null)
              setMessage(value => `${value.trim()} Sem vínculo com a atividade da Agenda.`.trim())
              input.current?.focus()
            }}><X size={15} aria-hidden="true" /></button>
        </div>}
        <textarea ref={input} value={message} maxLength={2000} rows={1} aria-label="Sua mensagem" placeholder="Escreva sua mensagem"
          onChange={event => setMessage(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault(); event.currentTarget.form?.requestSubmit()
            }
          }} />
        <button type="submit" className="primary-button compact" disabled={busy || !message.trim()}>Enviar</button>
      </form>
      {quotaText && <footer className="agenda-assistant-quota" aria-live="polite">{quotaText}</footer>}
    </section>}
  </div>
}

function formatActivityDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [year, month, day] = value.split('-').map(Number)
  const activityDay = Date.UTC(year, month - 1, day)
  const today = kanbanDate.format(new Date()).split('-').map(Number)
  const todayDay = Date.UTC(today[0], today[1] - 1, today[2])
  const difference = Math.round((activityDay - todayDay) / 86_400_000)
  const relative = difference === -1 ? 'Ontem' : difference === 0 ? 'Hoje' : difference === 1 ? 'Amanhã' : null
  const formatted = value.split('-').reverse().join('/')
  return relative ? `${relative} · ${formatted}` : formatted
}

function cardPrompt(activity: Pick<AssistantActivityReference, 'title' | 'type'>) {
  const purpose = activity.type === 'prova' ? 'estudar para' : 'me organizar para'
  return `Cria um card no Kanban para eu ${purpose} «${activity.title.trim()}».`
}

function ActivityResult({ activity, onOpen, onPrepare, agendaPath }: {
  activity: Activity; onOpen: () => void; onPrepare: () => void; agendaPath: string
}) {
  const color = ACTIVITY_TYPE_COLORS[activity.type as ActivityType]
  return <article className="assistant-activity-card" style={{ borderInlineStartColor: color }}>
    <div className="assistant-activity-heading">
      <span className="assistant-activity-type"><i aria-hidden="true" style={{ background: color }} />{activity.type_label}</span>
      <span className="assistant-activity-date"><CalendarDays size={14} aria-hidden="true" />
        <time dateTime={activity.date}>{formatActivityDate(activity.date)}</time>{` · ${activity.time || 'Sem horário'}`}
      </span>
    </div>
    {activity.id
      ? <a className="assistant-activity-title" href={agendaPath + '#atividade=' + encodeURIComponent(activity.id)} onClick={onOpen}>{activity.title}</a>
      : <strong className="assistant-activity-title">{activity.title}</strong>}
    <div className="assistant-activity-meta">
      {[activity.subject, activity.teacher && `Prof. ${activity.teacher}`, activity.is_general && 'Geral', activity.was_overridden && 'Ocorrência alterada']
        .filter(Boolean).join(' · ')}
      {activity.recurrence_summary && <small>Recorrência · {activity.recurrence_summary}</small>}
    </div>
    {activity.id && canCreateActivityCard(activity) && <button type="button" className="assistant-activity-action" onClick={onPrepare}
      aria-label={`Criar card com IA para ${activity.title.trim()}`}><Sparkles size={15} aria-hidden="true" /> Criar card com IA</button>}
  </article>
}

function fitMessageInput(field: HTMLTextAreaElement) {
  field.style.height = 'auto'
  const border = field.offsetHeight - field.clientHeight
  field.style.height = `${field.scrollHeight + border}px`
}

function CardPreview({ label, title, children, collapsible = true }: { label: string; title: string; children: ReactNode; collapsible?: boolean }) {
  if (!collapsible) return <section className="assistant-kanban assistant-kanban-static">
    <div className="assistant-kanban-static-heading"><span><strong>{label}</strong><small>{title}</small></span></div>
    <div className="assistant-kanban-body">{children}</div>
  </section>
  return <details className="assistant-kanban">
    <summary>
      <span><strong>{label}</strong><small>{title}</small></span>
      <ChevronDown size={18} aria-hidden="true" />
    </summary>
    <div className="assistant-kanban-body">{children}</div>
  </details>
}

function initialCardInput(draft: Draft): CardInput {
  const board = draft.boards.find(item => item.id === draft.board_id) ?? (draft.boards.length === 1 ? draft.boards[0] : undefined)
  return { ...draft.fields, board_id: board?.id ?? '', column_id: draft.column_id ?? board?.suggested_column_id ?? '' }
}

function DraftCard({ draft, busy, retryOnly, submitted, onFieldsChange, onAction }: {
  draft: Draft; busy: boolean; retryOnly: boolean; submitted: CardInput | null
  onFieldsChange: (fields: CardInput) => void
  onAction: (action: 'create' | 'cancel', fields?: CardInput) => void
}) {
  const [fields, setFields] = useState<CardInput>(() => submitted ?? initialCardInput(draft))
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!busy) onAction('create', retryOnly ? submitted ?? undefined : fields)
  }
  return <CardPreview label="Prévia do card" title={fields.title.trim() || draft.fields.title}>
    <DraftActivity draft={draft} />
    <form className="kb-form" onSubmit={create}>
      <CardFieldsEditor draft={draft} fields={fields} disabled={busy || retryOnly} onChange={next => { setFields(next); onFieldsChange(next) }} />
      <div className="assistant-kanban-actions">
        <button className="primary-button compact" type="submit" disabled={busy || !fields.column_id || !fields.title.trim()}>
          {retryOnly ? 'Tentar novamente' : 'Criar card'}
        </button>
        {!retryOnly && <button className="kb-link" type="button" disabled={busy} onClick={() => onAction('cancel')}>Cancelar</button>}
      </div>
    </form>
  </CardPreview>
}

function DraftActivity({ draft }: { draft: Draft }) {
  return draft.activity_title ? <small>Atividade da Agenda · {draft.activity_title}{draft.activity_date && ` · ${formatActivityDate(draft.activity_date)}`}</small> : null
}

function DraftBatch({ batch, busy, retryOnly, submitted, onFieldsChange, onAction }: {
  batch: Batch; busy: boolean; retryOnly: boolean; submitted: BatchInput[] | null
  onFieldsChange: (items: BatchInput[]) => void
  onAction: (action: 'create' | 'cancel', items?: BatchInput[]) => void
}) {
  const [fields, setFields] = useState<BatchInput[]>(() => submitted ?? batch.drafts.map(draft => ({ ...initialCardInput(draft), draft_id: draft.id })))
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const invalid = event.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:invalid, select:invalid, textarea:invalid')
    if (invalid) {
      const editor = invalid.closest('details')
      if (editor) editor.open = true
      invalid.reportValidity()
      return
    }
    onAction('create', retryOnly && submitted ? submitted : fields)
  }
  return <form className="assistant-batch kb-form" onSubmit={save} noValidate>
    {batch.drafts.map((draft, index) => <CardPreview key={draft.id} label={`Prévia ${index + 1} de ${batch.drafts.length}`} title={fields[index].title.trim() || draft.fields.title}>
      <DraftActivity draft={draft} />
      <CardFieldsEditor draft={draft} fields={fields[index]} disabled={busy || retryOnly}
        onChange={next => {
          const items = fields.map((item, i) => i === index ? { ...next, draft_id: draft.id } : item)
          setFields(items)
          onFieldsChange(items)
        }} />
    </CardPreview>)}
    <div className="assistant-kanban-actions">
      <button className="primary-button compact" type="submit" disabled={busy}>
        {retryOnly ? 'Tentar novamente' : `Criar ${batch.drafts.length} cards`}
      </button>
      {!retryOnly && <button className="kb-link" type="button" disabled={busy} onClick={() => onAction('cancel')}>Cancelar</button>}
    </div>
  </form>
}

function CardFieldsEditor({ draft, fields, disabled, onChange }: {
  draft: Draft; fields: CardInput; disabled: boolean; onChange: (fields: CardInput) => void
}) {
  const columns = draft.boards.find(item => item.id === fields.board_id)?.columns ?? []
  return <fieldset disabled={disabled}>
        <label>Quadro<select required value={fields.board_id} onChange={e => {
          const boardId = e.target.value
          const suggested = draft.boards.find(item => item.id === boardId)?.suggested_column_id ?? ''
          onChange({ ...fields, board_id: boardId, column_id: suggested })
        }}>
          <option value="">Escolha o quadro</option>{draft.boards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Coluna<select required value={fields.column_id} onChange={e => onChange({ ...fields, column_id: e.target.value })} disabled={!fields.board_id}>
          <option value="">Escolha a coluna</option>{columns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Título<input value={fields.title} onChange={e => onChange({ ...fields, title: e.target.value })} maxLength={160} required /></label>
        <label>Detalhes<textarea value={fields.description} onChange={e => onChange({ ...fields, description: e.target.value })} maxLength={3000} rows={2} /></label>
        <label>Prazo<input type="date" min={kanbanDate.format(new Date())} value={fields.due_date ?? ''} onChange={e => onChange({ ...fields, due_date: e.target.value || null })} /></label>
        <label>Prioridade<select value={fields.priority} onChange={e => onChange({ ...fields, priority: e.target.value as Fields['priority'] })}>
          {Object.entries(PRIORITIES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select></label>
  </fieldset>
}
