// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.removeItem('tech-2d:assistant-position')
  window.history.replaceState(null, '', '/')
})

describe('contrato do chat integrado', () => {
  it('moves the launcher, saves its position and only opens through a separate click', () => {
    const props = { account, endpoint, preferredClass: '2° TECH D' }
    const view = render(<AssistantChat {...props} />)
    const button = screen.getByRole('button', { name: 'Assistente' })
    const area = button.parentElement!
    area.getBoundingClientRect = () => new DOMRect(16, 16, 800, 600)
    button.getBoundingClientRect = () => new DOMRect(676, 571, 140, 45)
    button.setPointerCapture = vi.fn()
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
      Object.assign(event, { pointerId: 1, isPrimary: true })
      fireEvent(button, event)
    }
    pointer('pointerdown', 700, 590)
    pointer('pointermove', 1, 1)
    pointer('pointerup', 1, 1)
    fireEvent.click(button, { detail: 1 })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(area.style.getPropertyValue('--launcher-x')).toBe('0')
    expect(area.style.getPropertyValue('--launcher-y')).toBe('0')
    expect(area.hasAttribute('data-panel-below')).toBe(true)

    view.unmount()
    render(<AssistantChat {...props} />)
    const restored = screen.getByRole('button', { name: 'Assistente' })
    expect(restored.parentElement?.style.getPropertyValue('--launcher-x')).toBe('0')
    fireEvent.keyDown(restored, { key: 'ArrowRight' })
    expect(restored.parentElement?.style.getPropertyValue('--launcher-x')).toBe('0.05')
    fireEvent.keyDown(restored, { key: 'Home' })
    expect(restored.parentElement?.style.getPropertyValue('--launcher-x')).toBe('1')
    fireEvent.click(restored)
    expect(screen.getByRole('textbox', { name: 'Sua mensagem' })).toBeDefined()
  })

  it('alterna os convites enquanto fechado e abre o chat sem enviar mensagem', () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const props = { account, endpoint, preferredClass: '2° TECH D' }
    const view = render(<AssistantChat {...props} />)
    const first = screen.getByText('Quer saber o que tem na Agenda hoje?')
    const bubble = first.closest('[data-visible]')
    expect(bubble?.getAttribute('data-visible')).toBe('false')
    act(() => vi.advanceTimersByTime(6000))
    expect(bubble?.getAttribute('data-visible')).toBe('true')
    act(() => vi.advanceTimersByTime(10000))
    expect(bubble?.getAttribute('data-visible')).toBe('false')
    act(() => vi.advanceTimersByTime(50000))
    expect(bubble?.getAttribute('data-visible')).toBe('true')
    const second = screen.getByText('Posso te ajudar a encontrar o horário de um professor.')
    expect(second.closest('button')).toBe(screen.getByRole('button', { name: 'Assistente' }))

    view.rerender(<AssistantChat {...props} covered />)
    expect(screen.queryByText(first.textContent!)).toBeNull()
    view.rerender(<AssistantChat {...props} />)
    act(() => vi.advanceTimersByTime(6000))
    fireEvent.click(screen.getByText('Quer saber o que tem na Agenda hoje?'))
    expect(screen.getByRole('textbox', { name: 'Sua mensagem' })).toBeDefined()
    expect(screen.queryByText('Quer saber o que tem na Agenda hoje?')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('troca a dica sem enviar mensagens e envia a pergunta escolhida', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => Response.json({ answer: 'Vamos conferir a Agenda.' }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AssistantChat account={account} endpoint={endpoint} preferredClass="2° TECH D" welcomeActivities={[
      { title: 'Levar roupa de Educação Física', date: '2099-11-30', time: null, turmaId: '2° TECH D', type: 'tarefa' },
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Assistente' }))
    expect(screen.getByText('Levar roupa de Educação Física')).toBeDefined()
    expect(screen.getByText('Vale perguntar')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Próxima dica do D2' })).toBeNull()
    const notes = screen.getByRole('group', { name: 'Dicas do D2' })
    Object.defineProperty(notes, 'clientWidth', { value: 300 })
    const scrollTo = vi.fn(({ left }: ScrollToOptions) => { notes.scrollLeft = left ?? 0 })
    notes.scrollTo = scrollTo
    fireEvent.keyDown(notes, { key: 'ArrowRight' })
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300 })
    fireEvent.keyDown(notes, { key: 'ArrowRight' })
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0 })
    act(() => vi.advanceTimersByTime(12000))
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300 })
    notes.focus()
    act(() => vi.advanceTimersByTime(12000))
    expect(scrollTo).toHaveBeenCalledTimes(3)
    expect(fetchMock).not.toHaveBeenCalled()

    const message = 'O que tem na Agenda esta semana?'
    fireEvent.click(screen.getByRole('button', { name: message }))
    await screen.findByText('Vamos conferir a Agenda.')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1].body))).toMatchObject({ message, preferred_class: '2° TECH D' })
  })

  it('faz o D2 cumprimentar, pensar e reagir à resposta sem disparar mensagens ao tocar no mascote', async () => {
    let answer!: (response: Response) => void
    const fetchMock = vi.fn(async (_: string, init: RequestInit) => init.method === 'DELETE'
      ? new Response(null, { status: 204 }) : new Promise<Response>(resolve => { answer = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    chat()
    const mascot = screen.getByRole('button', { name: 'Cumprimentar o D2' })
    const frame = () => mascot.querySelector('.d2-mascot-frame')!
    expect(frame().getAttribute('data-pose')).toBe('saudacao')
    fireEvent.animationEnd(frame())
    expect(frame().getAttribute('data-pose')).toBe('repouso')
    fireEvent.click(mascot)
    expect(frame().getAttribute('data-pose')).toBe('saudacao')
    expect(fetchMock).not.toHaveBeenCalled()

    send('Oi')
    expect(frame().getAttribute('data-pose')).toBe('pensando')
    const thinking = screen.getByRole('status')
    expect(thinking.textContent).toBe('D2 está pensando…')
    expect(thinking.querySelector('[aria-hidden="true"] [data-pose="pensando"]')).not.toBeNull()
    expect(thinking.querySelectorAll('.assistant-thinking-dots i')).toHaveLength(3)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    answer(Response.json({ answer: 'Olá!' }))
    await screen.findByText('Olá!')
    expect(screen.queryByText('D2 está pensando…')).toBeNull()
    expect(frame().getAttribute('data-pose')).toBe('respondendo')
  })

  it('revela a resposta aos poucos, com o texto completo disponível para leitores de tela', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    const answer = 'A próxima atividade da turma é o trabalho de inglês na sexta-feira.'
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ answer })))
    chat()
    await act(async () => send('O que vem por aí?'))
    const fullText = screen.getByText(answer)
    expect(fullText.closest('[aria-hidden="true"]')).toBeNull()
    const visual = fullText.parentElement?.querySelector('[aria-hidden="true"]')
    expect(visual?.textContent).toBe('')
    act(() => vi.advanceTimersByTime(400))
    expect(visual?.textContent?.length).toBeGreaterThan(0)
    expect(visual?.textContent?.length).toBeLessThan(answer.length)
    act(() => vi.advanceTimersByTime(1400))
    expect(document.querySelector('.assistant-typing-text')).toBeNull()
    expect(screen.getByText(answer)).toBeDefined()
  })

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
    expect(screen.getByRole('button', { name: 'Cumprimentar o D2' }).querySelector('[data-pose="confirmacao"]')).not.toBeNull()
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
