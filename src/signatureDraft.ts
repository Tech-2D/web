import { MAX_LAYERS, type Design, type ImageLayer, type Layer, type ShapeLayer, type TextLayer } from './signatureCanvas'

type StoredLayer = TextLayer | ShapeLayer | (Omit<ImageLayer, 'source'> & { imageIndex: number })
type StoredDraft = {
  version: 1
  savedAt: string
  design: Omit<Design, 'layers'> & { layers: StoredLayer[] }
  images: string[]
}
export type SignatureDraft = { design: Design; savedAt: string }

export function signatureDraftKey(uid?: string) {
  return 'tech2d:signature-draft:v1:' + (uid || 'local')
}

export function saveSignatureDraft(storage: Pick<Storage, 'setItem'>, key: string, design: Design): string {
  const images: string[] = []
  const imageIndexes = new Map<HTMLCanvasElement, number>()
  const layers = design.layers.map((layer): StoredLayer => {
    if (layer.kind !== 'image') return layer
    const { source, ...properties } = layer
    let index = imageIndexes.get(source)
    if (index === undefined) {
      index = images.length
      images.push(source.toDataURL('image/png'))
      imageIndexes.set(source, index)
    }
    return { ...properties, imageIndex: index }
  })
  const savedAt = new Date().toISOString()
  const draft: StoredDraft = { version: 1, savedAt, design: { ...design, layers }, images }
  // One atomic write preserves the previous draft when the browser rejects it.
  storage.setItem(key, JSON.stringify(draft))
  return savedAt
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SIGNATURE_DRAFT')
  return value as Record<string, unknown>
}

function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

function color(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function parseDraft(raw: string): StoredDraft {
  const input = record(JSON.parse(raw))
  const design = record(input.design)
  const images = input.images
  if (input.version !== 1 || typeof input.savedAt !== 'string' || !Number.isFinite(Date.parse(input.savedAt))
    || !integer(design.width, 240, 1200) || !integer(design.height, 100, 1400)
    || !color(design.background) || typeof design.transparent !== 'boolean'
    || !Array.isArray(design.layers) || design.layers.length > MAX_LAYERS
    || !Array.isArray(images) || images.length > MAX_LAYERS
    || !images.every(image => typeof image === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))
  ) throw new Error('INVALID_SIGNATURE_DRAFT')

  const template = design.template
  if (template !== undefined && (typeof template !== 'string' || !['side', 'center', 'columns', 'right', 'banner', 'footer'].includes(template))) {
    throw new Error('INVALID_SIGNATURE_DRAFT')
  }

  const ids = new Set<string>()
  const layers = design.layers.map((value): StoredLayer => {
    const layer = record(value)
    const shape = layer.kind === 'shape'
    if (!text(layer.id, 128) || !layer.id || ids.has(layer.id) || !text(layer.label, 2048)
      || !integer(layer.width, shape ? 2 : 24, design.width as number)
      || !integer(layer.height, shape ? 2 : 18, design.height as number)
      || !integer(layer.x, 0, (design.width as number) - (layer.width as number))
      || !integer(layer.y, 0, (design.height as number) - (layer.height as number))
    ) throw new Error('INVALID_SIGNATURE_DRAFT')
    ids.add(layer.id)
    const bounds = {
      id: layer.id, label: layer.label,
      x: layer.x, y: layer.y, width: layer.width, height: layer.height,
    }
    if (layer.kind === 'image') {
      if (!integer(layer.imageIndex, 0, images.length - 1)) throw new Error('INVALID_SIGNATURE_DRAFT')
      return { ...bounds, kind: 'image', imageIndex: layer.imageIndex }
    }
    if (!color(layer.color)) throw new Error('INVALID_SIGNATURE_DRAFT')
    if (shape) {
      if (layer.preset !== undefined && typeof layer.preset !== 'boolean') throw new Error('INVALID_SIGNATURE_DRAFT')
      return { ...bounds, kind: 'shape', color: layer.color, preset: layer.preset }
    }
    if (layer.kind !== 'text' || !text(layer.value, 240)
      || typeof layer.font !== 'string' || !['Arial', 'Georgia', 'Verdana'].includes(layer.font)
      || !integer(layer.size, 8, 72) || typeof layer.bold !== 'boolean'
      || typeof layer.align !== 'string' || !['left', 'center', 'right'].includes(layer.align)
    ) throw new Error('INVALID_SIGNATURE_DRAFT')
    return {
      ...bounds, kind: 'text', value: layer.value, font: layer.font as TextLayer['font'],
      size: layer.size, color: layer.color, bold: layer.bold, align: layer.align as TextLayer['align'],
    }
  })
  return {
    version: 1, savedAt: input.savedAt, images,
    design: { width: design.width, height: design.height, background: design.background, transparent: design.transparent, template: template as Design['template'], layers },
  }
}

async function restoreImage(source: string): Promise<HTMLCanvasElement> {
  const image = new Image()
  image.src = source
  await image.decode()
  if (!integer(image.naturalWidth, 1, 1200) || !integer(image.naturalHeight, 1, 1200)) {
    throw new Error('INVALID_SIGNATURE_DRAFT_IMAGE')
  }
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('CANVAS_UNAVAILABLE')
  context.drawImage(image, 0, 0)
  return canvas
}

export async function loadSignatureDraft(storage: Pick<Storage, 'getItem'>, key: string): Promise<SignatureDraft | null> {
  const raw = storage.getItem(key)
  if (raw === null) return null
  const draft = parseDraft(raw)
  const images = await Promise.all(draft.images.map(restoreImage))
  const layers = draft.design.layers.map((layer): Layer => {
    if (layer.kind !== 'image') return layer
    const { imageIndex, ...properties } = layer
    return { ...properties, source: images[imageIndex] }
  })
  return { design: { ...draft.design, layers }, savedAt: draft.savedAt }
}
