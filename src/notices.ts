import type { AdminProfile } from './types'

export const NOTICE_TYPES = ['urgente', 'aviso', 'lembrete'] as const
export type NoticeType = (typeof NOTICE_TYPES)[number]

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  urgente: 'Urgente',
  aviso: 'Aviso',
  lembrete: 'Lembrete',
}

// Quanto menor, mais cedo o tipo aparece no quadro.
const NOTICE_TYPE_PRIORITY: Record<NoticeType, number> = { urgente: 0, aviso: 1, lembrete: 2 }

export const NOTICE_TITLE_MAX = 60
export const NOTICE_BODY_MAX = 500
export const NOTICE_TTL_DAYS = 7

type FirestoreDate = { toDate: () => Date }

export type Notice = {
  id: string
  turmaId: string
  title: string
  body: string
  type: NoticeType
  expiresAt: FirestoreDate | null
  createdBy?: string
  authorEmail?: string
  createdAt?: FirestoreDate | null
  updatedAt?: FirestoreDate | null
}

export function isNoticeActive(notice: Pick<Notice, 'expiresAt'>, now: Date): boolean {
  const expiresAt = notice.expiresAt?.toDate()
  return !!expiresAt && expiresAt.getTime() > now.getTime()
}

function createdMillis(notice: Pick<Notice, 'createdAt'>): number {
  return notice.createdAt?.toDate().getTime() ?? 0
}

// Urgentes primeiro; dentro de cada tipo, os mais recentes.
export function sortNotices<T extends Pick<Notice, 'type' | 'createdAt'>>(notices: T[]): T[] {
  return [...notices].sort((a, b) =>
    NOTICE_TYPE_PRIORITY[a.type] - NOTICE_TYPE_PRIORITY[b.type] || createdMillis(b) - createdMillis(a),
  )
}

export function activeNotices<T extends Pick<Notice, 'type' | 'createdAt' | 'expiresAt'>>(notices: T[], now: Date): T[] {
  return sortNotices(notices.filter((notice) => isNoticeActive(notice, now)))
}

export type NoticeDraft = { title: string; body: string; type: NoticeType }

export function validateNoticeDraft(draft: NoticeDraft): string | null {
  const title = draft.title.trim()
  const body = draft.body.trim()
  if (!title) return 'Informe um título.'
  if (title.length > NOTICE_TITLE_MAX) return `O título pode ter até ${NOTICE_TITLE_MAX} caracteres.`
  if (!body) return 'Escreva o texto do aviso.'
  if (body.length > NOTICE_BODY_MAX) return `O texto pode ter até ${NOTICE_BODY_MAX} caracteres.`
  if (!NOTICE_TYPES.includes(draft.type)) return 'Tipo de aviso inválido.'
  return null
}

export function canManageNotices(profile: AdminProfile | null, turmaId: string | null): boolean {
  if (!profile || !turmaId) return false
  return profile.role === 'superadmin' || (profile.role === 'representante' && profile.turmaId === turmaId)
}
