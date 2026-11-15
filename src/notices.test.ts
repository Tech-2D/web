import { describe, expect, it } from 'vitest'
import { activeNotices, isNoticeActive, sortNotices, validateNoticeDraft, type NoticeDraft } from './notices'

const NOW = new Date('2026-09-26T12:00:00Z')
const at = (iso: string) => ({ toDate: () => new Date(iso) })

describe('notices', () => {
  it('sorts urgent first, then newest within each type', () => {
    const sorted = sortNotices([
      { id: 'old-aviso', type: 'aviso' as const, createdAt: at('2026-09-01T00:00:00Z') },
      { id: 'new-lembrete', type: 'lembrete' as const, createdAt: at('2026-09-25T00:00:00Z') },
      { id: 'old-urgente', type: 'urgente' as const, createdAt: at('2026-08-01T00:00:00Z') },
      { id: 'new-aviso', type: 'aviso' as const, createdAt: at('2026-09-20T00:00:00Z') },
    ])
    expect(sorted.map((notice) => notice.id)).toEqual(['old-urgente', 'new-aviso', 'old-aviso', 'new-lembrete'])
  })

  it('hides expired notices and notices without a valid expiry', () => {
    const notices = [
      { id: 'ok', type: 'aviso' as const, createdAt: at('2026-09-20T00:00:00Z'), expiresAt: at('2026-10-01T00:00:00Z') },
      { id: 'expired', type: 'urgente' as const, createdAt: at('2026-09-20T00:00:00Z'), expiresAt: at('2026-09-26T11:59:59Z') },
      { id: 'missing', type: 'aviso' as const, createdAt: at('2026-09-20T00:00:00Z'), expiresAt: null },
    ]
    expect(activeNotices(notices, NOW).map((notice) => notice.id)).toEqual(['ok'])
    expect(isNoticeActive(notices[1], NOW)).toBe(false)
  })

  it('validates the draft', () => {
    const draft: NoticeDraft = { title: ' Prova ', body: 'Trazer calculadora', type: 'aviso' }
    expect(validateNoticeDraft(draft)).toBeNull()
    expect(validateNoticeDraft({ ...draft, title: '  ' })).toMatch(/título/)
    expect(validateNoticeDraft({ ...draft, title: 'x'.repeat(61) })).toMatch(/60/)
    expect(validateNoticeDraft({ ...draft, body: 'x'.repeat(501) })).toMatch(/500/)
  })
})
