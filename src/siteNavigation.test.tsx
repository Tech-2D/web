// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SiteNavigation } from './SiteNavigation'

const { getDoc, account } = vi.hoisted(() => ({ getDoc: vi.fn(), account: { currentUser: null as { uid: string } | null } }))
vi.mock('./firebase', async importOriginal => ({ ...await importOriginal<typeof import('./firebase')>(), auth: account }))
vi.mock('./dataClient', async importOriginal => ({ ...await importOriginal<typeof import('./dataClient')>(), getDoc }))

afterEach(() => {
  cleanup()
  account.currentUser = null
  getDoc.mockReset()
  sessionStorage.clear()
})

it('connects all pages on the same origin and identifies the current page', () => {
  for (const active of ['agenda', 'professores', 'pegaki', 'kanban', 'profile'] as const) {
    const html = renderToStaticMarkup(createElement(SiteNavigation, { active }))
    expect(html).toContain('href="/"')
    expect(html).toContain('href="/professores/"')
    expect(html).toContain('href="/notas/"')
    expect(html).not.toContain('href="/pegaki/"')
    expect(html).toContain('>Notas</a>')
    expect(html).toContain('lucide-clipboard-list')
    expect(html).toContain('href="/#kanban"')
    expect(html).toContain('aria-label="Abrir menu" aria-haspopup="dialog" aria-expanded="false"')
    expect(html).not.toContain('target=')
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    const paths = { agenda: '/', kanban: '/#kanban', profile: '/perfil/', professores: '/professores/', pegaki: '/notas/' }
    const currentLink = [...html.matchAll(/<a\b[^>]*>/g)].find(([tag]) => tag.includes('aria-current="page"'))?.[0]
    expect(currentLink).toContain(`href="${paths[active]}"`)
  }
})

it('shows the direct management link for the current Agenda role', () => {
  const navigation = (role?: 'representante' | 'superadmin', active: 'agenda' | 'professores' | 'pegaki' | 'admin' = 'pegaki') =>
    renderToStaticMarkup(createElement(SiteNavigation, { active, role }))

  expect(navigation()).not.toContain('href="/admin/"')
  expect(navigation('representante')).toMatch(/href="\/admin\/"[^]*?>Representante<\/a>/)
  expect(navigation('superadmin')).toMatch(/href="\/admin\/"[^]*?>Administração<\/a>/)
  expect(navigation('superadmin', 'admin')).toContain('href="/admin/" aria-current="page"')
  expect(navigation('superadmin', 'admin')).toContain('aria-label="Abrir menu"')
})

it('offers a direct link for an incomplete profile and remembers dismissal for the session', async () => {
  account.currentUser = { uid: 'student' }
  getDoc.mockResolvedValue({ data: () => ({ displayName: 'Lucas', className: ' ' }) })
  const first = render(<SiteNavigation active="agenda" />)
  const link = await screen.findByRole('link', { name: 'Ir para o perfil' })
  expect(link.getAttribute('href')).toBe('/perfil/#profiles-edit-title')
  expect(screen.getByText('Adicione sua turma para personalizar sua experiência no portal.')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Dispensar lembrete de perfil' }))
  expect(screen.queryByText('Complete seu perfil')).toBeNull()
  first.unmount()
  render(<SiteNavigation active="pegaki" />)
  expect(getDoc).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Complete seu perfil')).toBeNull()
})

it('does not show the reminder for a saved name and class, even when optional fields are blank', async () => {
  account.currentUser = { uid: 'student' }
  const data = vi.fn(() => ({ displayName: 'Lucas', className: '2° Tec D' }))
  getDoc.mockResolvedValue({ data })
  render(<SiteNavigation active="agenda" />)
  await waitFor(() => expect(data).toHaveBeenCalled())
  expect(screen.queryByText('Complete seu perfil')).toBeNull()
})
