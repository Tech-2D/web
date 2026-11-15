import { describe, expect, it } from 'vitest'
import { initialDesign } from './signatureCanvas'
import { loadSignatureDraft, saveSignatureDraft, signatureDraftKey } from './signatureDraft'

function storage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
  }
}

describe('local signature drafts', () => {
  it('restores text, positioning, colors, size and template for the saved account', async () => {
    const store = storage()
    const draft = initialDesign()
    draft.width = 720
    draft.height = 380
    draft.background = '#ffeedd'
    draft.transparent = true
    const name = draft.layers.find(layer => layer.kind === 'text')!
    if (name.kind !== 'text') throw Error('Missing text')
    name.value = 'Marina Ávila'
    name.font = 'Georgia'
    name.x = 80
    name.size = 35
    const key = signatureDraftKey('alice')
    const savedAt = saveSignatureDraft(store, key, draft)
    expect(await loadSignatureDraft(store, key)).toEqual({ design: draft, savedAt })
    expect(await loadSignatureDraft(store, signatureDraftKey('bob'))).toBeNull()
  })

  it('keeps the previous draft when the storage quota is exceeded', () => {
    const store = storage()
    const key = signatureDraftKey('alice')
    const draft = initialDesign()
    saveSignatureDraft(store, key, draft)
    const previous = store.getItem(key)
    const full = {
      setItem: () => { throw new DOMException('Full', 'QuotaExceededError') },
    }
    expect(() => saveSignatureDraft(full, key, { ...draft, background: '#000000' })).toThrow()
    expect(store.getItem(key)).toBe(previous)
  })

  it.each(['{broken', '{"version":2}', '{"version":1,"design":null}'])('rejects invalid data without replacing it', async raw => {
    const store = storage()
    const key = signatureDraftKey('alice')
    store.setItem(key, raw)
    await expect(loadSignatureDraft(store, key)).rejects.toThrow()
    expect(store.getItem(key)).toBe(raw)
  })

  it('rejects unsupported image references and out-of-bounds layers', async () => {
    const store = storage()
    const key = signatureDraftKey('alice')
    saveSignatureDraft(store, key, initialDesign())
    const saved = JSON.parse(store.getItem(key)!)
    saved.design.layers[0].x = -10
    store.setItem(key, JSON.stringify(saved))
    await expect(loadSignatureDraft(store, key)).rejects.toThrow()
    saved.design.layers[0].x = 14
    saved.images = ['https://example.test/external-image.png']
    store.setItem(key, JSON.stringify(saved))
    await expect(loadSignatureDraft(store, key)).rejects.toThrow()
  })
})
