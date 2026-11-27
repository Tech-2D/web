import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin,
  rectIntersection, useDroppable, useSensor, useSensors,
  type Activators, type CollisionDetection, type DragEndEvent, type DragOverEvent,
  type DragStartEvent, type PointerSensorOptions, type PointerSensorProps,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable, defaultAnimateLayoutChanges,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ArrowRight, CheckSquare, GripVertical, Plus, Settings2, Trash2, X } from 'lucide-react'
import { KanbanCardFace } from './KanbanCardFace'
import { KanbanDeleteDialog } from './KanbanDeleteDialog'
import { moveTask, moveTasks, reorder, taskMatches, type KanbanBoard, type KanbanColumn, type KanbanTask } from './kanban'

type Item = { kind: 'task' | 'column'; id: string; columnId: string }
type DropTarget = Item | { kind: 'trash' }
type PointerDrop = { target: DropTarget; after?: boolean }
type ActiveDrag = Item & {
  width: number
  taskIds: string[]
  clickToDrop: boolean
  pointerDrag: boolean
  pointerId: number | null
}
type BoardProps = {
  board: KanbanBoard
  disabled: boolean
  search: string
  priority: string
  canAddTask: boolean
  shared?: boolean
  onChange: (board: KanbanBoard) => Promise<boolean>
  onEditTask: (task: KanbanTask) => void
  onEditColumn: (column: KanbanColumn) => void
  onAddTask: (columnId: string) => void
  onInteractionChange?: (active: boolean) => void
  assignees?: { uid: string; name: string }[]
}

const columnKey = (id: string) => 'column:' + id
const taskKey = (id: string) => 'task:' + id
const trashKey = 'kanban:trash'
const doubleClickDelay = 650

// The second click starts the sensor. The next pointer release drops the card.
class DoubleClickSensor {
  static activators: Activators<PointerSensorOptions> = [{
    eventName: 'onClick',
    handler: ({ nativeEvent }: MouseEvent) => nativeEvent.button === 0,
  }]

  private readonly pointer: PointerSensor

  constructor(props: PointerSensorProps) {
    this.pointer = new PointerSensor(props)
  }

  get autoScrollEnabled() { return this.pointer.autoScrollEnabled }
}

function collisions(args: Parameters<CollisionDetection>[0], draggedIds: string[], filtered: boolean) {
  if (args.active.data.current?.kind === 'column') {
    const columns = args.droppableContainers.filter(c => c.data.current?.kind === 'column')
    return closestCenter({ ...args, droppableContainers: columns })
  }
  const candidates = args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)
  const trash = candidates.find(candidate => candidate.id === trashKey)
  if (trash) return [trash]

  const task = !filtered && candidates.find(candidate => {
    const id = String(candidate.id)
    return id.startsWith('task:') && !draggedIds.includes(id.slice(5))
  })
  return task ? [task] : candidates.filter(candidate => String(candidate.id).startsWith('column:')).slice(0, 1)
}

function reducedMotion() {
  return document.documentElement.dataset.motion === 'reduzido'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function KanbanBoardView({
  board, disabled, search, priority, canAddTask, shared = false, onChange, onEditTask,
  onEditColumn, onAddTask, onInteractionChange, assignees = [],
}: BoardProps) {
  const [active, setActive] = useState<ActiveDrag | null>(null)
  const [preview, setPreview] = useState<KanbanBoard | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [reduce, setReduce] = useState(false)
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const draft = useRef<KanbanBoard | null>(null)
  const drag = useRef<ActiveDrag | null>(null)
  const trashNode = useRef<HTMLDivElement>(null)
  const pointerDrop = useRef<PointerDrop | null>(null)
  const saving = useRef(false)
  const mounted = useRef(true)
  const pendingClick = useRef<{ taskId: string; timer: ReturnType<typeof setTimeout> | null } | null>(null)
  const filtered = !!search || !!priority
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(DoubleClickSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    mounted.current = true
    function recordRelease(event: PointerEvent) {
      const source = drag.current
      if (source?.kind !== 'task' || !source.pointerDrag || !event.isPrimary || event.button !== 0) return
      if (source.pointerId !== null && source.pointerId !== event.pointerId) return

      const element = document.elementFromPoint(event.clientX, event.clientY)
      if (element && trashNode.current?.contains(element)) {
        pointerDrop.current = { target: { kind: 'trash' } }
        return
      }
      const columnId = element?.closest<HTMLElement>('[data-kanban-column]')?.dataset.kanbanColumn
      if (!columnId) {
        pointerDrop.current = null
        return
      }
      const card = element?.closest<HTMLElement>('[data-kanban-task]')
      const id = card?.dataset.kanbanTask
      if (card && id && !filtered && !source.taskIds.includes(id)) {
        const bounds = card.getBoundingClientRect()
        pointerDrop.current = { target: { kind: 'task', id, columnId }, after: event.clientY > bounds.top + bounds.height / 2 }
      } else {
        pointerDrop.current = { target: { kind: 'column', id: columnId, columnId } }
      }
    }
    // Capture the final coordinates before the drag sensor handles the release.
    document.addEventListener('pointerup', recordRelease, true)
    return () => {
      mounted.current = false
      document.removeEventListener('pointerup', recordRelease, true)
      if (pendingClick.current?.timer != null) clearTimeout(pendingClick.current.timer)
    }
  }, [filtered])

  useEffect(() => {
    const visibleIds = new Set(board.tasks.filter(task => taskMatches(task, search, priority)).map(task => task.id))
    setSelected(current => {
      const visible = [...current].filter(id => visibleIds.has(id))
      return visible.length === current.size ? current : new Set(visible)
    })
  }, [board.tasks, search, priority])

  const view = preview || board
  const locked = disabled || saving.current || !!deleteIds
  const dragDisabled = locked || !!active
  const selectedTasks = board.tasks.filter(task => selected.has(task.id) && taskMatches(task, search, priority))
  const selectedIds = selectedTasks.map(task => task.id)
  const pendingDeletion = deleteIds ? board.tasks.filter(task => deleteIds.includes(task.id)) : []

  function clearPendingOpen() {
    if (pendingClick.current?.timer != null) clearTimeout(pendingClick.current.timer)
    pendingClick.current = null
  }

  function pressTask(taskId: string) {
    const pending = pendingClick.current
    if (pending?.taskId === taskId && pending.timer !== null) {
      // The second press can be held before movement starts.
      clearTimeout(pending.timer)
      pending.timer = null
    } else {
      clearPendingOpen()
    }
  }

  function openTask(task: KanbanTask, event: MouseEvent<HTMLButtonElement>, startDrag: () => void) {
    const secondClick = pendingClick.current?.taskId === task.id
    clearPendingOpen()
    if (locked || drag.current) return
    if (event.detail === 0) {
      onEditTask(task)
      return
    }
    if (secondClick) {
      startDrag()
      return
    }
    pendingClick.current = {
      taskId: task.id,
      timer: setTimeout(() => {
        pendingClick.current = null
        if (!saving.current && !drag.current) onEditTask(task)
      }, doubleClickDelay),
    }
  }

  function toggleSelection(id: string) {
    clearPendingOpen()
    setSelected(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setDraft(next: KanbanBoard | null) {
    draft.current = next
    setPreview(next)
  }

  async function save(next: KanbanBoard) {
    clearPendingOpen()
    if (disabled || saving.current) return false
    if (next === board || JSON.stringify(next) === JSON.stringify(board)) {
      setDraft(null)
      return false
    }
    saving.current = true
    setDraft(next)
    try {
      return await onChange(next)
    } finally {
      saving.current = false
      if (mounted.current) setDraft(null)
    }
  }

  function askToDelete(ids: string[]) {
    clearPendingOpen()
    if (!disabled && !saving.current && ids.length) setDeleteIds(ids)
  }

  async function deleteTasks() {
    if (!deleteIds || !pendingDeletion.length) return false
    const idSet = new Set(deleteIds)
    const accepted = await save({ ...board, tasks: board.tasks.filter(task => !idSet.has(task.id)) })
    if (accepted && mounted.current) {
      setSelected(current => new Set([...current].filter(id => !idSet.has(id))))
    }
    return accepted
  }

  function start(event: DragStartEvent) {
    if (locked) return
    clearPendingOpen()
    const item = event.active.data.current as Item
    const target = event.activatorEvent.target
    const fromSelection = target instanceof Element && !!target.closest('.kb-card-select')
    let taskIds: string[] = []
    if (item.kind === 'task') {
      if (selectedIds.includes(item.id)) {
        taskIds = selectedIds
      } else if (fromSelection) {
        taskIds = [...selectedIds, item.id]
        setSelected(new Set(taskIds))
      } else {
        taskIds = [item.id]
      }
    }
    const clickToDrop = event.activatorEvent.type === 'click'
    const pointerDown = event.activatorEvent.type === 'pointerdown'
    const next = {
      ...item,
      width: event.active.rect.current.initial?.width || 280,
      taskIds,
      clickToDrop,
      pointerDrag: clickToDrop || pointerDown,
      pointerId: pointerDown && event.activatorEvent instanceof PointerEvent
        ? event.activatorEvent.pointerId
        : null,
    }
    pointerDrop.current = null
    drag.current = next
    setActive(next)
    setReduce(reducedMotion())
    setDraft(board)
    onInteractionChange?.(true)
  }

  function over(event: DragOverEvent) {
    const current = draft.current
    const source = drag.current
    const target = event.over?.data.current as DropTarget | undefined
    setOverColumn(target && target.kind !== 'trash' ? target.columnId : null)
    if (filtered || !current || source?.kind !== 'task' || source.taskIds.length > 1 || !target || target.kind === 'trash') return
    const task = current.tasks.find(item => item.id === source.id)
    if (task && task.columnId !== target.columnId) {
      setDraft(moveTask(current, task.id, target.columnId, target.kind === 'task' ? target.id : undefined))
    }
  }

  function clearDrag() {
    drag.current = null
    pointerDrop.current = null
    setActive(null)
    setOverColumn(null)
    setDraft(null)
    onInteractionChange?.(false)
  }

  async function end(event: DragEndEvent) {
    const current = draft.current
    const source = drag.current
    const release = pointerDrop.current
    const pointerTask = source?.kind === 'task' && source.pointerDrag
    const target = pointerTask ? release?.target : event.over?.data.current as DropTarget | undefined
    clearDrag()
    if (disabled || !current || !source) return
    if (target?.kind === 'trash') {
      askToDelete(source.taskIds)
      return
    }
    if (!target) return
    if (source.kind === 'column') {
      await save({ ...current, columns: reorder(current.columns, source.id, target.columnId) })
    } else if (target.kind === 'column') {
      if (!filtered || current.tasks.some(task => source.taskIds.includes(task.id) && task.columnId !== target.columnId)) {
        await save(moveTasks(current, source.taskIds, target.columnId))
      }
    } else if (!source.taskIds.includes(target.id)) {
      if (pointerTask) {
        await save(moveTasks(current, source.taskIds, target.columnId, target.id, release?.after))
        return
      }
      const rect = event.active.rect.current.translated
      const activator = event.activatorEvent as PointerEvent
      const y = typeof activator.clientY === 'number'
        ? activator.clientY + event.delta.y
        : (rect?.top || 0) + (rect?.height || 0) / 2
      const targetRect = event.over!.rect
      await save(moveTasks(current, source.taskIds, target.columnId, target.id, y > targetRect.top + targetRect.height / 2))
    }
  }

  const activeColumn = active?.kind === 'column' ? view.columns.find(column => column.id === active.id) : null
  const activeTask = active?.kind === 'task' ? view.tasks.find(task => task.id === active.id) : null
  const activeTaskColumn = activeTask ? view.columns.find(column => column.id === activeTask.columnId) : null
  const draggingGroup = activeTask && active && active.taskIds.length > 1
    ? [activeTask, ...view.tasks.filter(task => task.id !== active.id && active.taskIds.includes(task.id))]
    : []
  const overlay = <DragOverlay zIndex={500} dropAnimation={reduce ? null : { duration: 230, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
    {active && <div aria-hidden="true" className={'kb-drag-preview' + (view.compact ? ' kb-compact' : '')} style={{ width: active.width }}>
      {activeColumn ? <div className={'kb-column kb-color-' + activeColumn.color}>
        <header className="kb-column-heading"><GripVertical size={16} /><h3>{activeColumn.name}</h3><span className="kb-count">{view.tasks.filter(task => task.columnId === activeColumn.id).length}</span></header>
        <div className="kb-cards">{view.tasks.filter(task => task.columnId === activeColumn.id).slice(0, 4).map(task =>
          <div className="kb-card" key={task.id}><KanbanCardFace assignees={assignees} task={task} column={activeColumn} /></div>)}</div>
      </div> : draggingGroup.length > 1 ? <div className="kb-drag-group">
        <span className="kb-drag-count">{draggingGroup.length} cartões</span>
        <div className="kb-drag-group-cards">
          {draggingGroup.map(task => <div className="kb-card kb-drag-group-card" key={task.id}>
            <strong>{task.title}</strong>
          </div>)}
        </div>
      </div> : activeTask && activeTaskColumn && <div className="kb-card">
        <KanbanCardFace assignees={assignees} task={activeTask} column={activeTaskColumn} />
      </div>}
    </div>}
  </DragOverlay>

  return <DndContext
    sensors={sensors} collisionDetection={args => collisions(args, drag.current?.taskIds || [], filtered)}
    onDragStart={start} onDragOver={over}
    onDragCancel={clearDrag} onDragEnd={event => void end(event)}
    accessibility={{
      screenReaderInstructions: { draggable: 'Pressione espaço para arrastar. Use as setas para mover. Pressione espaço novamente para soltar ou Escape para cancelar.' },
      announcements: {
        onDragStart: () => 'Item selecionado para mover.',
        onDragOver: ({ over }) => over?.id === trashKey ? 'Lixeira. Solte para excluir.'
          : over ? 'Nova posição disponível. Solte para confirmar.' : 'Fora do quadro. Soltar aqui cancela a alteração.',
        onDragEnd: () => 'Movimento finalizado.',
        onDragCancel: () => 'Movimento cancelado. Nada foi alterado.',
      },
    }}
  >
    {selectedIds.length > 0 && <div className="kb-selection-bar" role="group" aria-label="Ações dos cartões selecionados">
      <strong role="status">{selectedIds.length} {selectedIds.length === 1 ? 'cartão selecionado' : 'cartões selecionados'}</strong>
      <select aria-label="Mover cartões selecionados para" value="" disabled={dragDisabled}
        onChange={event => void save(moveTasks(board, selectedIds, event.target.value))}>
        <option value="" disabled>Mover para…</option>
        {board.columns.map(column => <option key={column.id} value={column.id}
          disabled={selectedTasks.every(task => task.columnId === column.id)}>{column.name}</option>)}
      </select>
      <button type="button" className="kb-selection-delete" disabled={dragDisabled} onClick={() => askToDelete(selectedIds)}>
        <Trash2 size={16} aria-hidden="true" /> Excluir
      </button>
      <button type="button" className="kb-icon" disabled={dragDisabled} aria-label="Limpar seleção" title="Limpar seleção"
        onClick={() => setSelected(new Set())}><X size={17} aria-hidden="true" /></button>
    </div>}
    <div className={'kb-board' + (view.compact ? ' kb-compact' : '') + (active ? ' kb-sorting' : '')}
      data-group-selected={selectedIds.length > 1 || undefined}>
      <SortableContext items={view.columns.map(column => columnKey(column.id))} strategy={horizontalListSortingStrategy}>
        {view.columns.map((column, columnIndex) => {
          const tasks = view.tasks.filter(task => task.columnId === column.id)
          const visible = tasks.filter(task => taskMatches(task, search, priority))
          const targeted = active?.kind === 'task' && overColumn === column.id
          return <SortableColumn key={column.id} column={column} disabled={locked} reduce={reduce} targeted={targeted} header={handle => <>
            <header className="kb-column-heading">
              {handle}<h3>{column.name}</h3><span className="kb-count">{tasks.length}</span>
              {column.done && <CheckSquare size={15} aria-label="Coluna de concluídas" />}
              <button type="button" className="kb-icon" disabled={dragDisabled} aria-label={'Configurar coluna ' + column.name}
                onClick={() => onEditColumn(column)}><Settings2 size={16} /></button>
            </header>
            <div className="kb-column-order">
              <button type="button" className="kb-icon" disabled={dragDisabled || columnIndex === 0}
                aria-label={'Mover coluna ' + column.name + ' para a esquerda'}
                onClick={() => void save({ ...board, columns: reorder(board.columns, column.id, board.columns[columnIndex - 1].id) })}><ArrowLeft size={14} /></button>
              <button type="button" className="kb-icon" disabled={dragDisabled || columnIndex === view.columns.length - 1}
                aria-label={'Mover coluna ' + column.name + ' para a direita'}
                onClick={() => void save({ ...board, columns: reorder(board.columns, column.id, board.columns[columnIndex + 1].id) })}><ArrowRight size={14} /></button>
            </div>
          </>}>
            <SortableContext items={visible.map(task => taskKey(task.id))} strategy={verticalListSortingStrategy}>
              <div className="kb-cards">
                {visible.map((task, index) => <SortableCard key={task.id} task={task} disabled={locked} reduce={reduce}
                  selected={selected.has(task.id)} groupDragging={!!active?.taskIds.includes(task.id)}
                  onPress={() => pressTask(task.id)} onControlPress={clearPendingOpen}
                  onOpen={(event, beginDrag) => openTask(task, event, beginDrag)}
                  onSelect={() => toggleSelection(task.id)} interactionDisabled={dragDisabled}
                  face={<KanbanCardFace assignees={assignees} task={task} column={column} />}>
                  <div className="kb-card-actions">
                    <label><span className="sr-only">Mover {task.title} para</span>
                      <select aria-label={'Mover ' + task.title + ' para'} disabled={dragDisabled} value={column.id}
                        onChange={event => void save(moveTask(board, task.id, event.target.value))}>
                        {view.columns.map(item => <option key={item.id} value={item.id}>Mover para: {item.name}</option>)}
                      </select>
                    </label>
                    <button type="button" className="kb-icon" aria-label={'Subir ' + task.title} disabled={dragDisabled || filtered || index === 0}
                      onClick={() => void save({ ...board, tasks: reorder(board.tasks, task.id, visible[index - 1].id) })}>↑</button>
                    <button type="button" className="kb-icon" aria-label={'Descer ' + task.title} disabled={dragDisabled || filtered || index === visible.length - 1}
                      onClick={() => void save({ ...board, tasks: reorder(board.tasks, task.id, visible[index + 1].id) })}>↓</button>
                  </div>
                </SortableCard>)}
                {!visible.length && <p className="kb-column-empty">{targeted
                  ? active?.clickToDrop ? 'Clique para soltar' : 'Solte os cartões aqui'
                  : tasks.length ? 'Nenhuma tarefa com esse filtro.' : 'Nenhuma tarefa por aqui.'}</p>}
              </div>
            </SortableContext>
            <button type="button" className="kb-add kb-new-task" disabled={dragDisabled || !canAddTask} onClick={() => onAddTask(column.id)}>
              <Plus size={16} /> Nova tarefa
            </button>
          </SortableColumn>
        })}
      </SortableContext>
    </div>
    {deleteIds && <KanbanDeleteDialog titles={pendingDeletion.map(task => task.title)} shared={shared}
      disabled={disabled || !pendingDeletion.length} onCancel={() => setDeleteIds(null)} onConfirm={deleteTasks} />}
    {typeof document !== 'undefined' && createPortal(<>
      {overlay}
      <TrashDrop active={active?.kind === 'task' && !disabled} clickToDrop={active?.clickToDrop ?? false}
        trashNode={trashNode} />
    </>, document.body)}
  </DndContext>
}

function TrashDrop({ active, clickToDrop, trashNode }: {
  active: boolean; clickToDrop: boolean; trashNode: RefObject<HTMLDivElement | null>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: trashKey, data: { kind: 'trash' }, disabled: !active })
  const setTrashNode = useCallback((node: HTMLDivElement | null) => {
    trashNode.current = node
    setNodeRef(node)
  }, [setNodeRef, trashNode])
  if (!active) return null
  return <div ref={setTrashNode} className={'kb-trash-drop' + (isOver ? ' kb-trash-over' : '')}>
    <Trash2 size={22} aria-hidden="true" />
    <span><strong>Lixeira</strong><small>{clickToDrop ? 'Clique para excluir' : 'Solte para excluir'}</small></span>
  </div>
}

function SortableColumn({ column, disabled, reduce, targeted, header, children }: {
  column: KanbanColumn; disabled: boolean; reduce: boolean; targeted: boolean
  header: (handle: ReactNode) => ReactNode; children: ReactNode
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: columnKey(column.id), data: { kind: 'column', id: column.id, columnId: column.id },
    disabled, transition: { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' },
  })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition: reduce ? 'none' : transition }
  return <section ref={setNodeRef} style={style} aria-label={column.name} data-kanban-column={column.id}
    className={'kb-column kb-color-' + column.color + (isDragging ? ' kb-drag-source' : '') + (targeted ? ' kb-drop-active' : '')}>
    {header(<button type="button" ref={setActivatorNodeRef} className="kb-grab kb-drag-handle" disabled={disabled}
      {...attributes} onPointerDown={event => listeners?.onPointerDown?.(event)} onKeyDown={event => listeners?.onKeyDown?.(event)}
      aria-label={'Arrastar coluna ' + column.name}><GripVertical size={16} aria-hidden="true" /></button>)}
    {children}
  </section>
}

function SortableCard({ task, disabled, reduce, selected, groupDragging, interactionDisabled, onPress, onControlPress, onOpen, onSelect, face, children }: {
  task: KanbanTask; disabled: boolean; reduce: boolean; selected: boolean; groupDragging: boolean
  interactionDisabled: boolean; onPress: () => void; onControlPress: () => void
  onOpen: (event: MouseEvent<HTMLButtonElement>, beginDrag: () => void) => void
  onSelect: () => void; face: ReactNode; children: ReactNode
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: taskKey(task.id), data: { kind: 'task', id: task.id, columnId: task.columnId }, disabled,
    transition: { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' },
    animateLayoutChanges: args => defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
  })
  function beginPointerDrag(event: ReactPointerEvent<HTMLElement>, beforeDrag: () => void) {
    // Keep the card face available for scrolling on touch screens.
    if (!event.isPrimary || event.button !== 0 || event.pointerType === 'touch') return
    beforeDrag()
    listeners?.onPointerDown?.(event)
  }
  const className = 'kb-card' + (selected ? ' kb-card-selected' : '') + (isDragging || groupDragging ? ' kb-drag-source' : '')
  return <article ref={setNodeRef} data-kanban-task={task.id} style={{ transform: CSS.Translate.toString(transform), transition: reduce ? 'none' : transition }}
    className={className}>
    <label className="kb-card-select" title="Selecionar cartão" onPointerDown={event => beginPointerDrag(event, onControlPress)}>
      <input type="checkbox" checked={selected} disabled={interactionDisabled} onChange={onSelect} aria-label={'Selecionar cartão ' + task.title} />
      <span>Selecionar</span>
    </label>
    <button type="button" ref={setActivatorNodeRef} className="kb-grab kb-card-grab kb-drag-handle" disabled={disabled}
      {...attributes} onPointerDown={event => {
        onControlPress()
        listeners?.onPointerDown?.(event)
      }} onKeyDown={event => listeners?.onKeyDown?.(event)}
      aria-label={'Arrastar tarefa ' + task.title}><GripVertical size={15} aria-hidden="true" /></button>
    <button type="button" className="kb-card-open" disabled={interactionDisabled}
      onPointerDown={event => beginPointerDrag(event, onPress)}
      onClick={event => onOpen(event, () => listeners?.onClick?.(event))}>{face}</button>
    {children}
  </article>
}
