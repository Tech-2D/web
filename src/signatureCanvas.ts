export type SignatureDraft = {
  name: string
  role: string
  organization: string
  email: string
  phone: string
  website: string
  extra: string
  layout: 'side' | 'stack'
  font: 'Arial' | 'Georgia' | 'Verdana'
  accent: string
  text: string
  background: string
  transparent: boolean
}

type Line = { text: string; font: string; height: number; color: string }
const width = 600
const padding = 28
const scale = 2

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.trim().split(/\s+/u)) {
    if (!word) continue
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

export function drawSignature(canvas: HTMLCanvasElement, draft: SignatureDraft, image: HTMLImageElement | null, preview = false) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const stacked = draft.layout === 'stack'
  const imageSize = 84
  const left = padding + (stacked ? 0 : image ? imageSize + 22 : 14)
  const top = padding + (stacked ? (image ? imageSize + 14 : 10) : 0)
  const lineWidth = width - padding - left
  const lines: Line[] = []
  const add = (text: string, size: number, weight: number, color: string) => {
    const font = weight + ' ' + size + 'px ' + draft.font
    ctx.font = font
    for (const part of wrap(ctx, text, lineWidth)) {
      lines.push({ text: part, font, height: Math.ceil(size * 1.38), color })
    }
  }

  add(draft.name.trim() || (preview ? 'Seu nome' : ''), 32, 700, draft.text)
  add(draft.role, 18, 600, draft.accent)
  add(draft.organization, 17, 400, draft.text)
  const identityLines = lines.length
  add(draft.email, 16, 400, draft.text)
  add(draft.phone, 16, 400, draft.text)
  add(draft.website, 16, 400, draft.accent)
  add(draft.extra, 16, 400, draft.text)
  const gap = identityLines > 0 && identityLines < lines.length ? 8 : 0
  const contentHeight = lines.reduce((total, line) => total + line.height, gap)
  const height = top + Math.max(contentHeight, !stacked && image ? imageSize : 0) + padding

  canvas.width = width * scale
  canvas.height = height * scale
  ctx.scale(scale, scale)

  if (!draft.transparent) {
    ctx.fillStyle = draft.background
    ctx.fillRect(0, 0, width, height)
  }

  ctx.fillStyle = draft.accent
  if (stacked) ctx.fillRect(padding, padding - 8, width - 2 * padding, 3)
  else if (!image) ctx.fillRect(padding, padding, 4, contentHeight)

  if (image) {
    const ratio = Math.min(imageSize / image.naturalWidth, imageSize / image.naturalHeight)
    const imageWidth = image.naturalWidth * ratio
    const imageHeight = image.naturalHeight * ratio
    const x = (stacked ? width / 2 : padding + imageSize / 2) - imageWidth / 2
    const y = padding + (imageSize - imageHeight) / 2
    ctx.drawImage(image, x, y, imageWidth, imageHeight)
  }

  ctx.textBaseline = 'middle'
  ctx.textAlign = stacked ? 'center' : 'left'
  let y = top
  for (const [index, line] of lines.entries()) {
    if (index === identityLines) y += gap
    ctx.fillStyle = line.color
    ctx.font = line.font
    ctx.fillText(line.text, stacked ? width / 2 : left, y + line.height / 2)
    y += line.height
  }
  return true
}
