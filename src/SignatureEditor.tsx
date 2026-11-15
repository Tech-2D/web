import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowDown, ArrowUp, Copy, Download, Grid2X2, ImagePlus, Layers, Minus, PenLine, Redo2, Square, Trash2, Type, Undo2 } from 'lucide-react'
import { PageHeading } from './PageHeading'
import { accent, applyTemplate, clamp, drawSignature, fitLayer, initialDesign, MAX_LAYERS, newShape, newText, type Design, type Font, type Layer, type Template } from './signatureCanvas'
import './signatureEditor.css'

type History = { current: Design; past: Design[]; future: Design[] }
type Gesture = {
  id: string
  pointerId: number
  mode: 'move' | 'resize'
  layer: Layer
  result: Layer
  startX: number
  startY: number
  scaleX: number
  scaleY: number
}

const templates: { id: Template; label: string; description: string }[] = [
  { id: 'side', label: 'Lateral', description: 'Foto ao lado do texto' },
  { id: 'center', label: 'Centralizado', description: 'Elementos alinhados ao centro' },
  { id: 'columns', label: 'Duas colunas', description: 'Informações lado a lado' },
  { id: 'right', label: 'Logo à direita', description: 'Texto à esquerda, marca à direita' },
  { id: 'banner', label: 'Faixa superior', description: 'Faixa de cor no topo' },
  { id: 'footer', label: 'Logo no rodapé', description: 'Marca abaixo dos contatos' },
]

const logos = [
  { name: 'Seara', file: 'seara.png' },
  { name: 'JBS', file: 'jbs.png' },
  { name: 'PicPay', file: 'picpay.png' },
  { name: 'Swift', file: 'swift.png' },
  { name: 'JBS Novos Negócios', file: 'jbs-novos-negocios.png' },
  { name: 'Friboi', file: 'friboi.png' },
  { name: 'Lhg Mining', file: 'lhg-mining.png' },
  { name: 'Instituto J&F', file: 'instituto-jf.png' },
  { name: 'Flora', file: 'flora.png' },
  { name: 'Eldorado Brasil', file: 'eldorado-brasil.png' },
]

function logoUrl(file: string) {
  return import.meta.env.BASE_URL + 'signature-logos/' + file
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label>{label}
    <input
      key={value}
      type="number"
      defaultValue={value}
      min={min}
      max={max}
      onBlur={event => {
        const next = Number.isFinite(event.target.valueAsNumber) ? clamp(event.target.valueAsNumber, min, max) : value
        event.target.value = String(next)
        if (next !== value) onChange(next)
      }}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
    />
  </label>
}

export function SignatureEditor() {
  const [history, setHistory] = useState<History>(() => ({ current: initialDesign(), past: [], future: [] }))
  const design = history.current
  const [selectedId, setSelectedId] = useState('')
  const [moving, setMoving] = useState<Layer | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [preview, setPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logosOpen, setLogosOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const logoButton = useRef<HTMLButtonElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const textEdited = useRef(false)
  const gesture = useRef<Gesture | null>(null)
  const selected = moving ?? design.layers.find(layer => layer.id === selectedId)
  const atLimit = design.layers.length >= MAX_LAYERS
  const hasContent = design.layers.some(layer => layer.kind === 'text' ? layer.value.trim() : layer.kind === 'image' || !layer.preset)

  useEffect(() => {
    if (!canvas.current) return
    const shown = moving ? { ...design, layers: design.layers.map(layer => layer.id === moving.id ? moving : layer) } : design
    drawSignature(canvas.current, shown, !preview)
  }, [design, moving, preview])

  function commit(change: (current: Design) => Design, remember = true) {
    setStatus('')
    setHistory(previous => {
      const current = change(previous.current)
      if (current === previous.current) return previous
      const past = remember ? [...previous.past.slice(-39), previous.current] : previous.past
      return { current, past, future: [] }
    })
  }

  function undo() {
    setStatus('')
    setHistory(({ current, past, future }) => {
      const previous = past.at(-1)
      return previous ? { current: previous, past: past.slice(0, -1), future: [current, ...future] } : { current, past, future }
    })
  }

  function redo() {
    setStatus('')
    setHistory(({ current, past, future }) => {
      const next = future[0]
      return next ? { current: next, past: [...past, current], future: future.slice(1) } : { current, past, future }
    })
  }

  function handleHistoryShortcut(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    if (key !== 'z' && key !== 'y') return
    const target = event.target
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return

    event.preventDefault()
    if (gesture.current) return
    if (key === 'y' || event.shiftKey) redo()
    else undo()
  }

  function editLayer(id: string, change: (layer: Layer) => Layer, remember = true) {
    commit(current => {
      let template = current.template
      const layers = current.layers.map(layer => {
        if (layer.id !== id) return layer
        const next = fitLayer(change(layer), current)
        if (next.x !== layer.x || next.y !== layer.y || next.width !== layer.width || next.height !== layer.height) template = undefined
        if (next.kind === 'text' && layer.kind === 'text' && next.align !== layer.align) template = undefined
        return next
      })
      return { ...current, template, layers }
    }, remember)
  }

  function addLayer(layer: Layer, afterContent = false) {
    commit(current => {
      if (current.layers.length >= MAX_LAYERS) return current
      if (afterContent) {
        if (current.template) {
          const withLogo = { ...current, layers: [...current.layers, layer] }
          const arranged = applyTemplate(withLogo, current.template)
          if (arranged !== withLogo) return arranged
        }
        const end = Math.max(0, ...current.layers.map(item => item.y + item.height))
        const y = current.layers.length ? end + 12 : 24
        const height = clamp(Math.max(current.height, y + layer.height + 24), 100, 1400)
        const next = { ...current, height, template: undefined }
        const placed = fitLayer({ ...layer, x: current.width - layer.width - 24, y }, next)
        return { ...next, layers: [...current.layers, placed] }
      }
      const stagger = (current.layers.length % 5) * 12
      const next = fitLayer({ ...layer, x: layer.x + stagger, y: layer.y + stagger }, current)
      return { ...current, template: undefined, layers: [...current.layers, next] }
    })
    setSelectedId(layer.id)
    setPreview(false)
  }

  function removeLayer(id: string) {
    commit(current => ({ ...current, template: undefined, layers: current.layers.filter(layer => layer.id !== id) }))
    setSelectedId('')
  }

  function reorder(id: string, offset: number) {
    commit(current => {
      const layers = [...current.layers]
      const index = layers.findIndex(layer => layer.id === id)
      const target = index + offset
      if (index < 0 || target < 0 || target >= layers.length) return current
      const [layer] = layers.splice(index, 1)
      layers.splice(target, 0, layer)
      return { ...current, template: undefined, layers }
    })
  }

  function selectLayer(id: string) {
    setPreview(false)
    setSelectedId(id)
  }

  function chooseTemplate(template: Template) {
    const next = applyTemplate(design, template)
    if (next === design) {
      setError('Os elementos ocupam mais espaço do que este modelo permite. Reduza alguns elementos e tente novamente.')
      return
    }
    setError('')
    setPreview(false)
    commit(() => next)
  }

  function startGesture(event: PointerEvent<HTMLButtonElement>, layer: Layer, mode: Gesture['mode']) {
    if (event.button !== 0 || gesture.current || !stage.current) return
    const rect = stage.current.getBoundingClientRect()
    gesture.current = {
      id: layer.id, pointerId: event.pointerId, mode, layer, result: layer,
      startX: event.clientX, startY: event.clientY,
      scaleX: design.width / rect.width, scaleY: design.height / rect.height,
    }
    setSelectedId(layer.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveGesture(event: PointerEvent<HTMLButtonElement>) {
    const action = gesture.current
    if (!action || event.pointerId !== action.pointerId) return
    const dx = (event.clientX - action.startX) * action.scaleX
    const dy = (event.clientY - action.startY) * action.scaleY
    const layer = action.layer
    action.result = action.mode === 'move'
      ? fitLayer({ ...layer, x: layer.x + dx, y: layer.y + dy }, design)
      : { ...layer, width: clamp(layer.width + dx, layer.kind === 'shape' ? 2 : 24, design.width - layer.x), height: clamp(layer.height + dy, layer.kind === 'shape' ? 2 : 18, design.height - layer.y) }
    setMoving(action.result)
  }

  function stopGesture(event: PointerEvent<HTMLButtonElement>, canceled = false) {
    const action = gesture.current
    if (!action || event.pointerId !== action.pointerId) return
    gesture.current = null
    setMoving(null)
    const { result, layer } = action
    if (!canceled && (result.x !== layer.x || result.y !== layer.y || result.width !== layer.width || result.height !== layer.height)) {
      editLayer(action.id, current => ({ ...current, x: result.x, y: result.y, width: result.width, height: result.height }))
    }
  }

  function nudge(event: KeyboardEvent<HTMLButtonElement>, layer: Layer, resize = false) {
    const step = event.shiftKey ? 10 : 1
    const deltas: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const delta = deltas[event.key]
    if (delta) {
      event.preventDefault()
      editLayer(layer.id, current => resize
        ? { ...current, width: clamp(current.width + delta[0], current.kind === 'shape' ? 2 : 24, design.width - current.x), height: clamp(current.height + delta[1], current.kind === 'shape' ? 2 : 18, design.height - current.y) }
        : { ...current, x: current.x + delta[0], y: current.y + delta[1] })
    }
    if (!resize && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault()
      removeLayer(layer.id)
    }
  }

  async function loadImage(url: string, name: string, isLogo = false) {
    setError('')
    setUploading(true)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      if (image.naturalWidth * image.naturalHeight > 20_000_000) {
        setError('A imagem é muito grande. Reduza suas dimensões e tente novamente.')
        return
      }
      const size = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight))
      const source = document.createElement('canvas')
      source.width = Math.max(1, Math.round(image.naturalWidth * size))
      source.height = Math.max(1, Math.round(image.naturalHeight * size))
      const ctx = source.getContext('2d')
      if (!ctx) throw new Error('Canvas indisponível')
      ctx.drawImage(image, 0, 0, source.width, source.height)
      const ratio = (isLogo ? 128 : 104) / Math.max(source.width, source.height)
      addLayer({
        id: crypto.randomUUID(), kind: 'image', label: name, source, x: 28, y: 28,
        width: Math.max(24, Math.round(source.width * ratio)), height: Math.max(18, Math.round(source.height * ratio)),
      }, isLogo)
      if (isLogo) {
        setLogosOpen(false)
        logoButton.current?.focus()
      }
    } catch {
      setError(isLogo ? 'Não foi possível carregar o logo. Tente novamente.' : 'Não foi possível abrir a imagem. Tente outro arquivo.')
    } finally {
      setUploading(false)
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || atLimit) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Escolha uma imagem PNG, JPG ou WebP de até 5 MB.')
      return
    }

    const url = URL.createObjectURL(file)
    try {
      await loadImage(url, file.name)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  async function download() {
    if (!hasContent || uploading || exporting || moving) return
    setError('')
    setStatus('')
    setExporting(true)
    try {
      const output = document.createElement('canvas')
      if (!drawSignature(output, design)) throw new Error('Canvas indisponível')
      const png = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'))
      if (!png) throw new Error('PNG indisponível')
      const url = URL.createObjectURL(png)
      const link = document.createElement('a')
      link.href = url
      link.download = 'assinatura.png'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus('PNG gerado. Insira a imagem na sua assinatura no Outlook.')
    } catch {
      setError('Não foi possível gerar o PNG. Tente novamente.')
    } finally {
      setExporting(false)
    }
  }

  const bounds = (layer: Layer) => ({
    left: (layer.x / design.width * 100) + '%', top: (layer.y / design.height * 100) + '%',
    width: (layer.width / design.width * 100) + '%', height: (layer.height / design.height * 100) + '%',
  })
  const selectedIndex = design.layers.findIndex(layer => layer.id === selected?.id)
  const setSize = (key: 'width' | 'height', value: number) => commit(current => {
    const next = { ...current, [key]: value, template: undefined }
    return { ...next, layers: current.layers.map(layer => fitLayer(layer, next)) }
  })

  return <main className="signature-page portal-main" aria-label="Editor de assinatura de e-mail" onKeyDownCapture={handleHistoryShortcut}>
    <header className="signature-heading">
      <PageHeading icon={PenLine} title="Assinatura de e-mail" description="Monte o layout e baixe uma imagem para usar no Outlook." />
      <button type="button" className="primary-button compact" onClick={download} disabled={!hasContent || uploading || exporting || Boolean(moving)}>
        <Download size={18} />{exporting ? 'Gerando PNG…' : 'Baixar PNG'}
      </button>
    </header>
    {(error || status) && <p className="signature-message" role={error ? 'alert' : 'status'}>{error || status}</p>}

    <section className="signature-templates" aria-label="Modelos de assinatura">
      <h2>Modelos</h2>
      {templates.map(template => <button key={template.id} type="button" onClick={() => chooseTemplate(template.id)}>
        <span aria-hidden="true" className={'signature-template-icon ' + template.id}><i /><i /><i /></span>
        <span><strong>{template.label}</strong><small>{template.description}</small></span>
      </button>)}
      <button type="button" className="signature-blank" disabled={!design.layers.length} onClick={() => { commit(current => ({ ...current, template: undefined, layers: [] })); setSelectedId(''); setPreview(false) }}>Começar em branco</button>
    </section>

    <div className="signature-workspace">
      <section className="signature-board" aria-labelledby="signature-board-title">
        <div className="signature-tools">
          <h2 id="signature-board-title">Área de edição</h2>
          <div className="signature-button-group">
            <button type="button" title="Desfazer (Ctrl+Z ou ⌘Z)" aria-label="Desfazer" aria-keyshortcuts="Control+Z Meta+Z" disabled={!history.past.length || Boolean(moving)} onClick={undo}><Undo2 size={17} /></button>
            <button type="button" title="Refazer (Ctrl+Shift+Z, Ctrl+Y ou ⌘Shift+Z)" aria-label="Refazer" aria-keyshortcuts="Control+Shift+Z Control+Y Meta+Shift+Z" disabled={!history.future.length || Boolean(moving)} onClick={redo}><Redo2 size={17} /></button>
            <button type="button" title="Mostrar grade" aria-label="Mostrar grade" aria-pressed={showGrid} onClick={() => setShowGrid(!showGrid)}><Grid2X2 size={16} /></button>
            <button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Voltar a editar' : 'Prévia limpa'}</button>
          </div>
        </div>
        <div className="signature-add" aria-label="Adicionar elementos">
          <button type="button" disabled={atLimit} onClick={() => addLayer(newText())}><Type size={17} />Texto</button>
          <label className="signature-upload">
            <ImagePlus size={17} />{uploading ? 'Carregando…' : 'Imagem'}
            <input aria-label="Adicionar imagem" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={uploading || atLimit} />
          </label>
          <button ref={logoButton} type="button" aria-expanded={logosOpen} aria-controls="signature-logo-library" onClick={() => setLogosOpen(open => !open)}><ImagePlus size={17} />Logos de empresas</button>
          <button type="button" disabled={atLimit} onClick={() => addLayer(newShape('Divisória', 156, 4, accent))}><Minus size={17} />Divisória</button>
          <button type="button" disabled={atLimit} onClick={() => addLayer(newShape('Retângulo', 135, 56, '#eef1fd'))}><Square size={17} />Retângulo</button>
        </div>
        <section id="signature-logo-library" className="signature-logo-library" aria-label="Logos de empresas" hidden={!logosOpen}>
          {logosOpen && <>
            <p>Escolha um logo para adicionar à prancheta.</p>
            <div className="signature-logo-grid">
              {logos.map(logo => <button
                key={logo.file}
                className="signature-logo-card"
                type="button"
                disabled={uploading || atLimit}
                onClick={() => void loadImage(logoUrl(logo.file), logo.name, true)}
              >
                <span className="signature-logo-image"><img alt="" src={logoUrl(logo.file)} /></span>
                <span>{logo.name}</span>
              </button>)}
            </div>
          </>}
        </section>
        {atLimit && <p className="signature-tip" role="status">Limite de {MAX_LAYERS} elementos. Remova um para adicionar outro.</p>}
        <div className="signature-proof" data-grid={showGrid && !preview}>
          <div
            ref={stage}
            className="signature-stage"
            style={{ aspectRatio: design.width + ' / ' + design.height }}
            onPointerDown={event => { if (event.currentTarget === event.target) setSelectedId('') }}
          >
            <canvas ref={canvas} role="img" aria-label="Composição da assinatura" />
            {!preview && design.layers.map(layer => {
              const displayed = moving?.id === layer.id ? moving : layer
              return <button
                type="button" className="signature-hit" key={layer.id} style={bounds(displayed)}
                aria-label={layer.kind === 'text' ? layer.value || layer.label : layer.label} aria-pressed={selected?.id === layer.id}
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Delete"
                onFocus={() => setSelectedId(layer.id)}
                onClick={() => setSelectedId(layer.id)}
                onDoubleClick={() => { if (layer.kind === 'text') textarea.current?.focus() }}
                onPointerDown={event => startGesture(event, layer, 'move')}
                onPointerMove={moveGesture}
                onPointerUp={event => stopGesture(event)}
                onPointerCancel={event => stopGesture(event, true)}
                onLostPointerCapture={event => stopGesture(event, true)}
                onKeyDown={event => nudge(event, layer)}
              />
            })}
            {!preview && selected && <div className="signature-selection" style={bounds(selected)}>
              <button
                type="button" className="signature-resize" aria-label="Redimensionar elemento" title="Arraste para redimensionar"
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                onPointerDown={event => startGesture(event, selected, 'resize')}
                onPointerMove={moveGesture}
                onPointerUp={event => stopGesture(event)}
                onPointerCancel={event => stopGesture(event, true)}
                onLostPointerCapture={event => stopGesture(event, true)}
                onKeyDown={event => nudge(event, selected, true)}
              />
            </div>}
          </div>
        </div>
        <div className="signature-board-footer"><span>{design.width} × {design.height} px</span><span>{preview ? 'Visual da imagem exportada' : 'Arraste para mover. Use o canto para redimensionar.'}</span></div>
        <p className="signature-tip">Ctrl+Z desfaz · Ctrl+Shift+Z ou Ctrl+Y refaz</p>
      </section>

      <aside className="signature-inspector" aria-label="Controles da assinatura">
        <section aria-labelledby="signature-properties">
          <h2 id="signature-properties">{selected ? 'Elemento selecionado' : 'Prancheta'}</h2>
          {selected ? <>
            <p className="signature-layer-label">{selected.label}</p>
            {selected.kind === 'text' && <>
              <label>Texto
                <textarea key={selected.id} ref={textarea} value={selected.value} maxLength={240} rows={2} placeholder={selected.label}
                  onFocus={() => { textEdited.current = false }}
                  onChange={event => {
                    const value = event.target.value
                    editLayer(selected.id, layer => layer.kind === 'text' ? { ...layer, value } : layer, !textEdited.current)
                    textEdited.current = true
                  }} />
              </label>
              <div className="signature-properties">
                <label>Fonte<select value={selected.font} onChange={event => editLayer(selected.id, layer => layer.kind === 'text' ? { ...layer, font: event.target.value as Font } : layer)}>
                  <option>Arial</option><option>Georgia</option><option>Verdana</option>
                </select></label>
                <NumberField label="Tamanho da fonte" value={selected.size} min={8} max={72} onChange={size => editLayer(selected.id, layer => layer.kind === 'text' ? { ...layer, size, height: Math.max(layer.height, Math.ceil(size * 1.4)) } : layer)} />
                <label>Alinhamento<select value={selected.align} onChange={event => editLayer(selected.id, layer => layer.kind === 'text' ? { ...layer, align: event.target.value as 'left' | 'center' | 'right' } : layer)}>
                  <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                </select></label>
                <label className="signature-checkbox"><input type="checkbox" checked={selected.bold} onChange={event => editLayer(selected.id, layer => layer.kind === 'text' ? { ...layer, bold: event.target.checked } : layer)} />Negrito</label>
              </div>
            </>}
            {selected.kind !== 'image' && <label className="signature-color"><input type="color" value={selected.color} onChange={event => editLayer(selected.id, layer => layer.kind === 'image' ? layer : { ...layer, color: event.target.value })} /> Cor do elemento</label>}
            <div className="signature-properties">
              <NumberField label="Posição X" value={selected.x} min={0} max={design.width - selected.width} onChange={x => editLayer(selected.id, layer => ({ ...layer, x }))} />
              <NumberField label="Posição Y" value={selected.y} min={0} max={design.height - selected.height} onChange={y => editLayer(selected.id, layer => ({ ...layer, y }))} />
              <NumberField label="Largura" value={selected.width} min={selected.kind === 'shape' ? 2 : 24} max={design.width - selected.x} onChange={width => editLayer(selected.id, layer => ({ ...layer, width }))} />
              <NumberField label="Altura" value={selected.height} min={selected.kind === 'shape' ? 2 : 18} max={design.height - selected.y} onChange={height => editLayer(selected.id, layer => ({ ...layer, height }))} />
            </div>
            <div className="signature-button-group signature-layer-actions">
              <button type="button" title="Trazer para frente" aria-label="Trazer para frente" disabled={selectedIndex === design.layers.length - 1} onClick={() => reorder(selected.id, 1)}><ArrowUp size={16} /></button>
              <button type="button" title="Enviar para trás" aria-label="Enviar para trás" disabled={selectedIndex <= 0} onClick={() => reorder(selected.id, -1)}><ArrowDown size={16} /></button>
              <button type="button" title="Duplicar" aria-label="Duplicar elemento" disabled={atLimit} onClick={() => addLayer({ ...selected, id: crypto.randomUUID(), label: selected.label + ' (cópia)' })}><Copy size={16} /></button>
              <button type="button" title="Remover" aria-label="Remover elemento" onClick={() => removeLayer(selected.id)}><Trash2 size={16} /></button>
            </div>
            <button className="signature-text-button" type="button" onClick={() => setSelectedId('')}>Editar prancheta</button>
          </> : <>
            <div className="signature-properties">
              <NumberField label="Largura" value={design.width} min={240} max={1200} onChange={width => setSize('width', width)} />
              <NumberField label="Altura" value={design.height} min={100} max={1400} onChange={height => setSize('height', height)} />
            </div>
            <label className="signature-color"><input type="color" value={design.background} disabled={design.transparent} onChange={event => commit(current => ({ ...current, background: event.target.value }))} />Cor do fundo</label>
            <label className="signature-checkbox"><input type="checkbox" checked={design.transparent} onChange={event => commit(current => ({ ...current, transparent: event.target.checked }))} />Fundo transparente</label>
          </>}
        </section>
        <section className="signature-layers" aria-labelledby="signature-layers-title">
          <h2 id="signature-layers-title"><Layers size={17} aria-hidden="true" />Camadas</h2>
          {!design.layers.length && <p>Adicione um elemento ou escolha um modelo.</p>}
          {[...design.layers].reverse().map(layer => {
            const Icon = layer.kind === 'text' ? Type : layer.kind === 'image' ? ImagePlus : Square
            return <button key={layer.id} type="button" aria-pressed={selected?.id === layer.id} onClick={() => selectLayer(layer.id)}>
              <Icon size={15} aria-hidden="true" /><span>{layer.kind === 'text' && layer.value.trim() ? layer.value : layer.label}</span>
            </button>
          })}
        </section>
      </aside>
    </div>
  </main>
}
