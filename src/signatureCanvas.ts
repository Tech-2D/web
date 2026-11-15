export type Font = 'Arial' | 'Georgia' | 'Verdana'
export type Bounds = { x: number; y: number; width: number; height: number }

type LayerBase = Bounds & { id: string; label: string }
export type TextLayer = LayerBase & {
  kind: 'text'
  value: string
  font: Font
  size: number
  color: string
  bold: boolean
  align: CanvasTextAlign & ('left' | 'center' | 'right')
}
export type ImageLayer = LayerBase & { kind: 'image'; source: HTMLCanvasElement }
export type ShapeLayer = LayerBase & { kind: 'shape'; color: string; preset?: boolean }
export type Layer = TextLayer | ImageLayer | ShapeLayer
export type Design = {
  width: number
  height: number
  background: string
  transparent: boolean
  layers: Layer[]
}
export type Template = 'side' | 'center' | 'columns'

export const MAX_LAYERS = 24
export const accent = '#0a2dc4'
const ink = '#202e47'

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(Math.round(value), minimum), maximum)
}

export function fitLayer<T extends Layer>(layer: T, design: Pick<Design, 'width' | 'height'>): T {
  const width = clamp(layer.width, layer.kind === 'shape' ? 2 : 24, design.width)
  const height = clamp(layer.height, layer.kind === 'shape' ? 2 : 18, design.height)
  return {
    ...layer, width, height,
    x: clamp(layer.x, 0, design.width - width),
    y: clamp(layer.y, 0, design.height - height),
  }
}

export function newText(label = 'Novo texto', size = 18): TextLayer {
  return {
    id: crypto.randomUUID(), kind: 'text', label, value: '', font: 'Arial', size,
    color: ink, bold: false, align: 'left', x: 32, y: 32, width: 280, height: 42,
  }
}

export function newShape(label: string, width: number, height: number, color: string): ShapeLayer {
  return { id: crypto.randomUUID(), kind: 'shape', label, x: 32, y: 32, width, height, color }
}

function starterLayers(): TextLayer[] {
  return [
    { ...newText('Seu nome', 32), bold: true },
    { ...newText('Cargo ou área', 18), bold: true, color: accent },
    newText('Empresa ou instituição', 17),
    newText('E-mail', 16),
    newText('Telefone', 16),
  ].map(layer => ({ ...layer, height: Math.ceil(layer.size * 1.4) + 2 }))
}

export function initialDesign(): Design {
  return applyTemplate({ width: 640, height: 230, background: '#ffffff', transparent: false, layers: [] }, 'side')
}

/** Reposition existing content. Custom shapes stay at their current positions. */
export function applyTemplate(design: Design, template: Template): Design {
  const custom = design.layers.filter(layer => layer.kind !== 'shape' || !layer.preset)
  const existing = custom.length ? custom : starterLayers()
  const texts = existing.filter(layer => layer.kind === 'text')
  const images = existing.filter(layer => layer.kind === 'image')
  const centered = template === 'center'
  const columns = template === 'columns'
  const padding = 28
  const photoWidth = 84
  const photoGap = 10
  const imageColumns = Math.max(1, Math.floor((design.width - padding * 2 + photoGap) / (photoWidth + photoGap)))
  const imageBand = images.length && (centered || columns)
    ? Math.ceil(images.length / imageColumns) * (photoWidth + photoGap) + 8
    : 0
  const left = !centered && !columns && images.length ? padding + photoWidth + 20 : padding
  const rowTop = padding + imageBand
  const half = Math.floor((design.width - 2 * padding - 28) / 2)
  let y = rowTop
  const placedTexts = texts.map((layer, index) => {
    const rowHeight = Math.max(layer.height, Math.ceil(layer.size * 1.4) + 2)
    const column = columns && index % 2 === 1 ? 1 : 0
    const x = columns ? padding + column * (half + 28) : left
    const result: TextLayer = {
      ...layer, x, y, width: columns ? half : design.width - padding - left,
      height: rowHeight, align: centered ? 'center' : 'left',
    }
    if (!columns) y += rowHeight
    else if (column === 1 || index === texts.length - 1) {
      const previous = texts[index - 1]
      y += column === 1 ? Math.max(rowHeight, previous.height, Math.ceil(previous.size * 1.4) + 2) : rowHeight
    }
    return result
  })
  const placedImages: ImageLayer[] = images.map((layer, index) => {
    if (!centered && !columns) {
      return { ...layer, x: padding - 8, y: padding + index * (photoWidth + photoGap), width: photoWidth, height: photoWidth }
    }
    const row = Math.floor(index / imageColumns)
    const count = Math.min(imageColumns, images.length - row * imageColumns)
    const rowWidth = count * photoWidth + (count - 1) * photoGap
    const start = centered ? Math.round((design.width - rowWidth) / 2) : padding
    return { ...layer, x: start + (index % imageColumns) * (photoWidth + photoGap), y: padding + row * (photoWidth + photoGap), width: photoWidth, height: photoWidth }
  })
  const required = Math.max(y, ...placedImages.map(layer => layer.y + layer.height)) + padding
  if (required > 1400) return design
  const height = Math.max(design.height, required)
  const decoration = centered
    ? { x: Math.round(design.width / 2) - 22, y: 14, width: 44, height: 3 }
    : columns
      ? { x: padding + half + 13, y: rowTop, width: 2, height: Math.max(18, y - rowTop) }
      : { x: 14, y: rowTop, width: 3, height: Math.max(18, y - rowTop) }

  const byId = new Map<string, Layer>([...placedTexts, ...placedImages].map(layer => [layer.id, layer]))
  const layers = existing.map(layer => byId.get(layer.id) ?? layer)
  if (layers.length < MAX_LAYERS) {
    layers.unshift({ ...newShape('Divisória do modelo', 44, 3, accent), ...decoration, preset: true })
  }
  const next = { ...design, height }
  return { ...next, layers: layers.map(layer => fitLayer(layer, next)) }
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (!text.trim()) return ['']
  const lines: string[] = []
  let line = ''
  for (const word of text.trim().split(/\s+/u)) {
    const candidate = line ? line + ' ' + word : word
    if (ctx.measureText(candidate).width <= max) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = ''
    for (const character of word) {
      if (line && ctx.measureText(line + character).width > max) {
        lines.push(line)
        line = ''
      }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines
}

export function drawSignature(canvas: HTMLCanvasElement, design: Design, preview = false) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const scale = 2
  if (canvas.width !== design.width * scale) canvas.width = design.width * scale
  if (canvas.height !== design.height * scale) canvas.height = design.height * scale
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, design.width, design.height)
  if (!design.transparent) {
    ctx.fillStyle = design.background
    ctx.fillRect(0, 0, design.width, design.height)
  }
  for (const layer of design.layers) {
    const { x, y, width, height } = layer
    if (layer.kind === 'shape') {
      ctx.fillStyle = layer.color
      ctx.fillRect(x, y, width, height)
    } else if (layer.kind === 'image') {
      const ratio = Math.min(width / layer.source.width, height / layer.source.height)
      const w = layer.source.width * ratio
      const h = layer.source.height * ratio
      ctx.drawImage(layer.source, x + (width - w) / 2, y + (height - h) / 2, w, h)
    } else {
      const placeholder = !layer.value.trim()
      if (placeholder && !preview) continue
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, width, height)
      ctx.clip()
      ctx.font = (layer.bold ? '700 ' : '400 ') + layer.size + 'px ' + layer.font
      ctx.fillStyle = layer.color
      ctx.globalAlpha = placeholder ? .48 : 1
      ctx.textAlign = layer.align
      ctx.textBaseline = 'middle'
      const anchor = layer.align === 'center' ? x + width / 2 : layer.align === 'right' ? x + width - 1 : x + 1
      const lineHeight = Math.ceil(layer.size * 1.35)
      const lines = (placeholder ? layer.label : layer.value).split('\n').flatMap(line => wrapLine(ctx, line, width - 2))
      lines.forEach((line, index) => ctx.fillText(line, anchor, y + lineHeight * (index + .5), width - 2))
      ctx.restore()
    }
  }
  return true
}
