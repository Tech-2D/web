import type { User } from 'firebase/auth'
import { API_BASE } from './apiBase'

export interface ClosureBlock {
  kind: 'text' | 'heading' | 'callout' | 'link' | 'divider'
  text: string
  url?: string
}

export interface ClosureScreen {
  title: string
  label: string
  layout: 'split' | 'center' | 'poster'
  texture: 'grid' | 'dots' | 'plain'
  typeface: 'portal' | 'editorial' | 'mono'
  artwork: 'd2' | 'tools' | 'sun' | 'calendar' | 'image' | 'none'
  imageUrl: string
  background: string
  foreground: string
  accent: string
  blocks: ClosureBlock[]
}

export interface ClosureSettings {
  revision: number
  draft: ClosureScreen | null
  published: ClosureScreen | null
}

export const closurePalettes = [
  { label: 'Azul Tech', background: '#101d47', foreground: '#ffffff', accent: '#aac4ff' },
  { label: 'Sol de férias', background: '#fff0ce', foreground: '#41200a', accent: '#a24019' },
  { label: 'Verde escolar', background: '#def0e5', foreground: '#123727', accent: '#146044' },
  { label: 'Lavanda', background: '#eee7ff', foreground: '#2d184f', accent: '#6636a0' },
]

export const closureTemplates: { label: string; screen: ClosureScreen }[] = [
  { label: 'Manutenção', screen: {
    ...closurePalettes[0],
    title: 'Estamos cuidando da Agenda', label: 'Manutenção',
    layout: 'split', texture: 'grid', typeface: 'portal', artwork: 'd2', imageUrl: '',
    blocks: [{ kind: 'text', text: 'A Agenda está passando por uma manutenção. Volte em breve para consultar as atividades da sua turma.' }],
  } },
  { label: 'Férias', screen: {
    ...closurePalettes[1],
    title: 'A Agenda entrou de férias', label: 'Recesso escolar',
    layout: 'poster', texture: 'dots', typeface: 'editorial', artwork: 'sun', imageUrl: '',
    blocks: [{ kind: 'text', text: 'Bom descanso! A Agenda volta a funcionar no início das aulas.' }],
  } },
  { label: 'Volta às aulas', screen: {
    ...closurePalettes[2],
    title: 'Estamos preparando o próximo período', label: 'Volta às aulas',
    layout: 'center', texture: 'plain', typeface: 'portal', artwork: 'calendar', imageUrl: '',
    blocks: [{ kind: 'text', text: 'Logo você poderá acompanhar as atividades do novo período por aqui.' }],
  } },
]

export function closureHttpsUrl(value?: string) {
  if (!value || !/^https:\/\//i.test(value.trim())) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}

export async function agendaClosureRequest<T>(user: User, admin: boolean, signal?: AbortSignal, input?: unknown): Promise<T> {
  const token = await user.getIdToken()
  const response = await fetch(API_BASE + (admin ? '/api/admin/agenda-closure' : '/api/agenda-closure'), {
    method: input ? 'POST' : 'GET',
    headers: input ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : { Authorization: 'Bearer ' + token },
    body: input ? JSON.stringify(input) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || 'Não foi possível consultar o fechamento da Agenda.')
  }
  return response.json()
}
