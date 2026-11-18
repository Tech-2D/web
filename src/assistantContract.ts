import type { KanbanTask } from './kanban'

export type Column = { id: string; name: string; done: boolean }
export type Board = { id: string; name: string; columns: Column[]; suggested_column_id?: string | null }
export type Fields = { title: string; description: string; due_date: string | null; priority: KanbanTask['priority'] }
export type Draft = { state: 'draft'; id: string; boards: Board[]; board_id: string | null; column_id: string | null; fields: Fields; activity_ids: string[]; activity_title: string | null; activity_date?: string | null; retry_only?: boolean }
export type Saved = { state: 'saved'; task: KanbanTask; board: Pick<Board, 'id' | 'name'>; column: Column; activity_title: string | null }
export type Batch = { state: 'batch'; id: string; drafts: Draft[]; retry_only?: boolean }
export type Kanban = Draft | Saved | Batch | { state: 'batch_saved'; cards: Saved[] } | { state: 'missing' }
export type AssistantActivityReference = { id: string; title: string; date: string; type: string }
export type Activity = Omit<AssistantActivityReference, 'id'> & {
  id: string | null
  type_label: string
  subject?: string | null
  teacher?: string | null
  time?: string | null
  is_general?: boolean
  recurrence_summary?: string | null
  was_overridden?: boolean
}
export type AssistantResponse = {
  answer: string
  kanban?: Kanban | null
  cards?: Activity[]
  remaining_messages?: number | null
  unlimited_messages?: boolean
}
export type CardInput = Fields & { board_id: string; column_id: string }
export type BatchInput = CardInput & { draft_id: string }

type Data = Record<string, unknown>
const object = (value: unknown): value is Data => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const string = (value: unknown): value is string => typeof value === 'string'
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(string)
const priority = (value: unknown) => value === 'none' || value === 'low' || value === 'medium' || value === 'high'
const date = (value: unknown): value is string => string(value) && /^\d{4}-\d{2}-\d{2}$/.test(value)
const column = (value: unknown) => object(value) && string(value.id) && string(value.name) && typeof value.done === 'boolean'
const board = (value: unknown) => object(value) && string(value.id) && string(value.name) &&
  Array.isArray(value.columns) && value.columns.every(column)
const fields = (value: unknown) => object(value) && string(value.title) && string(value.description) &&
  (value.due_date === null || date(value.due_date)) && priority(value.priority)

function draft(value: unknown) {
  return object(value) && value.state === 'draft' && string(value.id) && fields(value.fields) &&
    Array.isArray(value.boards) && value.boards.every(board) &&
    (value.board_id === null || string(value.board_id)) && (value.column_id === null || string(value.column_id)) &&
    strings(value.activity_ids) && (value.activity_title === null || string(value.activity_title)) &&
    (value.activity_date == null || date(value.activity_date))
}

function saved(value: unknown) {
  if (!object(value) || value.state !== 'saved' || !object(value.task) ||
      !object(value.board) || !string(value.board.id) || !string(value.board.name) || !column(value.column)) return false
  const task = value.task
  return string(task.id) && string(task.columnId) && string(task.title) && string(task.description) &&
    priority(task.priority) && (task.dueDate == null || date(task.dueDate)) && strings(task.labels) &&
    Array.isArray(task.checklist) && task.checklist.every(item => object(item) && string(item.id) && string(item.text) && typeof item.done === 'boolean') &&
    (task.activityIds == null || strings(task.activityIds)) && (task.assigneeId == null || string(task.assigneeId))
}

function kanban(value: unknown) {
  if (!object(value)) return false
  if (value.state === 'draft') return draft(value)
  if (value.state === 'saved') return saved(value)
  if (value.state === 'missing') return true
  if (value.state === 'batch') return string(value.id) && Array.isArray(value.drafts) && value.drafts.every(draft)
  return value.state === 'batch_saved' && Array.isArray(value.cards) && value.cards.every(saved)
}

export function parseAssistantResponse(value: unknown): AssistantResponse {
  if (!object(value) || !string(value.answer) ||
    (value.cards !== undefined && (!Array.isArray(value.cards) || !value.cards.every(card =>
      object(card) && (card.id === null || string(card.id)) && string(card.title) && string(card.type) &&
      string(card.type_label) && date(card.date) &&
      ['subject', 'teacher', 'time', 'recurrence_summary'].every(key => card[key] == null || string(card[key]))))) ||
    (value.kanban != null && !kanban(value.kanban)) ||
    (value.remaining_messages != null && (!Number.isInteger(value.remaining_messages) || Number(value.remaining_messages) < 0)) ||
    (value.unlimited_messages !== undefined && typeof value.unlimited_messages !== 'boolean')) {
    throw new TypeError('Resposta inválida do Assistente')
  }
  return value as AssistantResponse
}

export function parseAssistantError(value: unknown) {
  return object(value) ? {
    detail: typeof value.detail === 'string' ? value.detail : undefined,
    code: typeof value.code === 'string' ? value.code : undefined,
    operation: typeof value.operation === 'string' ? value.operation : undefined,
  } : {}
}
