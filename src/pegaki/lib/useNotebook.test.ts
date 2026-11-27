// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, expect, it } from 'vitest'
import { useNotebook } from './useNotebook'

afterEach(() => { cleanup(); localStorage.clear() })

it('keeps offline notes scoped to the account even on the same browser', () => {
  const alice = { uid: 'alice' } as User
  const bob = { uid: 'bob' } as User
  localStorage.setItem('aprovae:v4:grades:2', JSON.stringify({ Matemática: { s1avg: '99' } }))

  const first = renderHook(() => useNotebook(alice, 2, 2026, false))
  expect(first.result.current.grades).toEqual({})
  act(() => first.result.current.setModes({ s1: 'media', s2: 'notas' }))
  first.unmount()

  const second = renderHook(() => useNotebook(bob, 2, 2026, false))
  expect(second.result.current.grades).toEqual({})
  expect(second.result.current.modes.s1).toBe('notas')
  second.unmount()

  const restored = renderHook(() => useNotebook(alice, 2, 2026, false))
  expect(restored.result.current.modes.s1).toBe('media')
})
