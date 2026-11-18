// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AssistantChat from './AssistantChat'
import { parseAssistantResponse } from './assistantContract'

const account = { uid: 'fixture', getIdToken: async () => 'fixture-token' } as User
const endpoint = 'https://assistant.example.invalid'
const column = { id: 'todo', name: 'A fazer', done: false }
const board = { id: 'board', name: 'Estudos', columns: [column] }
const fields = { title: 'Estudar BI', description: 'Ler as notas', due_date: null, priority: 'none' }
const draft = { state: 'draft', id: 'draft', boards: [board], board_id: board.id, column_id: column.id, fields,
  activity_ids: [], activity_title: null, activity_date: null }

function chat() {
  render(<AssistantChat account={account} endpoint={endpoint} preferredClass="2° TECH D" />)
  fireEvent.click(screen.getByRole('button', { name: 'Assistente' }))
}

function send(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Sua mensagem' }), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('contrato do chat integrado', () => {
  it('encaminha o “sim” ao chat e inclui os campos da prévia para o servidor decidir se deve gravar', async () => {
    window.history.replaceState(null, '', `${import.meta.env.BASE_URL}admin/`)
    const posts: { path: string; body: Record<string, unknown> }[] = []
    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      if (init.method === 'DELETE') return new Response(null, { status: 204 })
      const body = JSON.parse(String(init.body))
      posts.push({ path: new URL(input).pathname, body })
      if (body.message === 'Crie um card') return Response.json({ answer: 'Confira a prévia.', kanban: draft })
      if (body.message === 'cadê o grelo') return Response.json({ answer: 'Você quis dizer Grilo?' })
      if (body.message === 'sim') return Response.json({ answer: 'Marcelo Grilo na grade.' })
      return Response.json({ answer: 'Card criado no Kanban.', kanban: {
        state: 'saved', board, column, activity_title: null,
        task: { id: 'draft', columnId: column.id, title: 'Título revisado', description: '',
          priority: 'none', dueDate: null, labels: [], checklist: [] },
      } })
    })
    chat()
    send('Crie um card')
    await screen.findByText('Confira a prévia.')
    const titleField = screen.getByDisplayValue(fields.title)
    fireEvent.change(titleField, { target: { value: 'Título revisado' } })
    send('cadê o grelo')
    await screen.findByText('Você quis dizer Grilo?')
    send('sim')
    await screen.findByText('Marcelo Grilo na grade.')
    expect(posts[2]).toMatchObject({ path: '/api/chat', body: { message: 'sim', draft: { draft_id: 'draft' } } })
    send('cria o card')
    await screen.findByText('Card criado no Kanban.')
    const kanbanLink = screen.getByRole('link', { name: 'Ver no Kanban' })
    expect(kanbanLink.getAttribute('href')).toBe(`${import.meta.env.BASE_URL}#kanban`)
    expect(posts[3]).toMatchObject({ path: '/api/chat',
      body: { message: 'cria o card', draft: { draft_id: 'draft', fields: { title: 'Título revisado' } } } })
  })

  it('trata 429 temporário sem zerar cota e reenvia a mesma operação', async () => {
    const requestIds: string[] = []
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => {
      if (init.method === 'DELETE') return new Response(null, { status: 204 })
      const body = JSON.parse(String(init.body))
      requestIds.push(body.request_id)
      if (requestIds.length === 1) return Response.json({ answer: 'Olá', remaining_messages: 19 })
      if (requestIds.length === 2) return Response.json({ detail: 'Aguarde um instante.', code: 'rate_limited' }, { status: 429 })
      if (requestIds.length === 3) return Response.json({ answer: 'Continuamos', remaining_messages: 18 })
      return Response.json({ detail: 'Você atingiu o limite diário.', code: 'daily_quota' }, { status: 429 })
    })
    chat()
    send('Oi')
    await screen.findByText('19 mensagens restantes hoje')
    send('Quais as provas?')
    await screen.findByRole('alert')
    expect(screen.getByText('19 mensagens restantes hoje')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar mensagem' }))
    await screen.findByText('18 mensagens restantes hoje')
    expect(requestIds[2]).toBe(requestIds[1])
    send('E amanhã?')
    await screen.findByText('0 mensagens restantes hoje')
    await waitFor(() => expect(requestIds).toHaveLength(4))
  })

  it('confirma a prévia com o botão e usa o endpoint de gravação explícito', async () => {
    const posts: { path:string; body:Record<string,unknown> }[] = []
    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      if (init.method === 'DELETE') return new Response(null, { status: 204 })
      const path = new URL(input).pathname
      posts.push({ path, body: JSON.parse(String(init.body)) })
      if (path === '/api/chat') return Response.json({ answer: 'Confira a prévia.', kanban: draft })
      return Response.json({ answer: 'Card criado.', kanban: null })
    })
    chat()
    send('Crie um card')
    await screen.findByText('Confira a prévia.')
    fireEvent.click(screen.getByText('Prévia do card'))
    fireEvent.click(screen.getByRole('button', { name: /^Criar card$/ }))
    await screen.findByText('Card criado.')
    expect(posts[1]).toMatchObject({ path: '/api/kanban', body: { action: 'create',
      confirmation_source: 'button', draft_id: 'draft' } })
  })

  it('rejeita uma prévia sem campos, um resultado inválido e uma cota malformada', () => {
    expect(() => parseAssistantResponse({ answer: 'texto', kanban: { state: 'draft', id: 'draft' } })).toThrow()
    expect(() => parseAssistantResponse({ answer: 'texto', cards: [null] })).toThrow()
    expect(() => parseAssistantResponse({ answer: 'texto', remaining_messages: '10' })).toThrow()
  })
})
