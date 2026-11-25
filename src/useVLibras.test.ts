// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { readStoredVLibras, storeVLibras, VLIBRAS_KEY } from './accessibility'
import { useVLibras } from './useVLibras'

afterEach(() => {
  cleanup()
  document.getElementById('vlibras-script')?.remove()
  localStorage.removeItem(VLIBRAS_KEY)
})

it('loads VLibras only after opt-in and hides it when the preference is turned off', () => {
  const root = document.documentElement
  expect(readStoredVLibras()).toBe(false)
  const view = renderHook(({ enabled }) => useVLibras(enabled), { initialProps: { enabled: readStoredVLibras() } })
  expect(document.getElementById('vlibras-script')).toBeNull()
  expect(root.hasAttribute('data-vlibras-enabled')).toBe(false)

  storeVLibras(true)
  view.rerender({ enabled: readStoredVLibras() })
  const script = document.getElementById('vlibras-script')
  expect(script).not.toBeNull()
  expect(root.hasAttribute('data-vlibras-enabled')).toBe(true)

  storeVLibras(false)
  view.rerender({ enabled: readStoredVLibras() })
  expect(root.hasAttribute('data-vlibras-enabled')).toBe(false)
  view.rerender({ enabled: true })
  expect(document.getElementById('vlibras-script')).toBe(script)
  expect(root.hasAttribute('data-vlibras-enabled')).toBe(true)
})
