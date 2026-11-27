import { useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { ArrowDown, ArrowUp, GripVertical, Monitor, Plus, Smartphone, Trash2 } from 'lucide-react'
import { AgendaClosureScreen } from './AgendaClosureScreen'
import { agendaClosureRequest, closureHttpsUrl, closurePalettes, closureTemplates, type ClosureBlock, type ClosureScreen, type ClosureSettings } from './agendaClosure'

const blockLabels = { text: 'Parágrafo', heading: 'Subtítulo', callout: 'Destaque', link: 'Botão com link', divider: 'Divisor' }
const colors = { background: 'Fundo', foreground: 'Texto', accent: 'Destaque' } as const

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: ReactNode
}) {
  return <label>{label}<select className="portal-control" value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>
}

export function AgendaClosureAdmin({ user }: { user: User }) {
  const [settings, setSettings] = useState<ClosureSettings>()
  const [screen, setScreen] = useState<ClosureScreen>(closureTemplates[0].screen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const [mobile, setMobile] = useState(false)
  const [livePreview, setLivePreview] = useState(false)
  const [newBlock, setNewBlock] = useState<ClosureBlock['kind']>('text')
  const [dragging, setDragging] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<'publish' | 'reopen'>()

  useEffect(() => {
    const controller = new AbortController()
    void agendaClosureRequest<ClosureSettings>(user, true, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setSettings(result)
      setScreen(result.draft ?? closureTemplates[0].screen)
    }).catch((cause: Error) => { if (!controller.signal.aborted) setError(cause.message) })
    return () => controller.abort()
  }, [user, reload])

  function change(patch: Partial<ClosureScreen>) {
    setScreen(current => ({ ...current, ...patch }))
    setLivePreview(false)
    setMessage('')
    setConfirmation(undefined)
  }

  function updateBlock(index: number, patch: Partial<ClosureBlock>) {
    change({ blocks: screen.blocks.map((block, at) => at === index ? { ...block, ...patch } : block) })
  }

  function moveBlock(from: number, to: number) {
    if (to < 0 || to >= screen.blocks.length || from === to) return
    const blocks = [...screen.blocks]
    const [block] = blocks.splice(from, 1)
    blocks.splice(to, 0, block)
    change({ blocks })
    setMessage(`${blockLabels[block.kind]} movido para a posição ${to + 1}.`)
  }

  async function execute(action: 'save' | 'publish' | 'reopen') {
    if (!settings || busy) return
    setMessage('')
    setError('')
    if (action !== 'reopen' && (!screen.title.trim()
      || (screen.artwork === 'image' && !closureHttpsUrl(screen.imageUrl))
      || screen.blocks.some(block => block.kind !== 'divider' && (!block.text.trim() || (block.kind === 'link' && !closureHttpsUrl(block.url)))))) {
      setError('Preencha o título e os textos dos blocos. Use endereços HTTPS na imagem e nos botões.')
      return
    }
    setBusy(true)
    setConfirmation(undefined)
    try {
      const result = await agendaClosureRequest<ClosureSettings>(user, true, undefined, { action, revision: settings.revision, screen })
      setSettings(result)
      if (action !== 'reopen' && result.draft) setScreen(result.draft)
      if (action === 'reopen') setLivePreview(false)
      setMessage(action === 'save' ? 'Rascunho salvo.' : action === 'publish' ? 'Tela publicada. A Agenda está fechada.' : 'Agenda reaberta.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  function refresh() {
    if (settings && !window.confirm('Recarregar o painel e descartar alterações ainda não salvas?')) return
    setSettings(undefined)
    setConfirmation(undefined)
    setLivePreview(false)
    setError('')
    setMessage('')
    setReload(value => value + 1)
  }

  if (!settings) return <section className="interface-panel agenda-closure-panel">
    {error ? <><p role="alert">{error}</p><button className="portal-control" onClick={refresh}>Tentar novamente</button></>
      : <p role="status">Carregando editor…</p>}
  </section>

  return <div className="agenda-closure-editor">
    <header className="interface-panel agenda-closure-panel agenda-closure-controls">
      <div>
        <strong>{settings.published ? 'Agenda fechada' : 'Agenda aberta'}</strong>
        <p>{settings.published ? 'Os usuários estão vendo a tela publicada.' : 'Os usuários podem consultar o calendário.'}</p>
      </div>
      <div className="agenda-closure-actions">
        <button type="button" className="portal-control" disabled={busy} onClick={refresh}>Recarregar</button>
        <button type="button" className="portal-control" disabled={busy} onClick={() => void execute('save')}>Salvar rascunho</button>
        {settings.published && <button type="button" className="portal-control" disabled={busy} onClick={() => setConfirmation('reopen')}>Reabrir Agenda</button>}
        <button type="button" className="portal-control agenda-closure-primary" disabled={busy}
          onClick={() => setConfirmation('publish')}>{settings.published ? 'Atualizar tela publicada' : 'Publicar e fechar Agenda'}</button>
      </div>
      {confirmation && <div className="agenda-closure-confirm">
        <strong>{confirmation === 'publish' ? 'Mostrar esta tela aos usuários?' : 'Voltar a mostrar o calendário?'}</strong>
        <div className="agenda-closure-actions">
          <button type="button" className="portal-control" onClick={() => setConfirmation(undefined)}>Cancelar</button>
          <button type="button" className="portal-control agenda-closure-primary" onClick={() => void execute(confirmation)}>Confirmar</button>
        </div>
      </div>}
      {error && <p className="agenda-closure-feedback" role="alert">{error}</p>}
      {message && <p className="agenda-closure-feedback" role="status">{message}</p>}
    </header>

    <div className="agenda-closure-workspace">
      <fieldset className="interface-panel agenda-closure-panel agenda-closure-fields" disabled={busy}>
        <section>
          <h3>Modelos</h3>
          <div className="agenda-closure-actions">{closureTemplates.map(template =>
            <button className="portal-control" key={template.label} type="button" onClick={() => {
              if (window.confirm('Aplicar o modelo e substituir a edição atual?')) change(template.screen)
            }}>{template.label}</button>)}</div>
        </section>
        <section>
          <h3>Mensagem</h3>
          <label>Etiqueta<input className="portal-control" value={screen.label} maxLength={45} onChange={e => change({ label: e.target.value })} /></label>
          <label>Título<input className="portal-control" value={screen.title} maxLength={100} onChange={e => change({ title: e.target.value })} /></label>
        </section>
        <section>
          <h3>Aparência</h3>
          <div className="agenda-closure-field-grid">
            <SelectField label="Layout" value={screen.layout} onChange={value => change({ layout: value as ClosureScreen['layout'] })}>
              <option value="split">Lateral</option><option value="center">Centralizado</option><option value="poster">Cartaz</option>
            </SelectField>
            <SelectField label="Fonte" value={screen.typeface} onChange={value => change({ typeface: value as ClosureScreen['typeface'] })}>
              <option value="portal">Portal</option><option value="editorial">Editorial</option><option value="mono">Monoespaçada</option>
            </SelectField>
            <SelectField label="Textura" value={screen.texture} onChange={value => change({ texture: value as ClosureScreen['texture'] })}>
              <option value="grid">Grade</option><option value="dots">Pontos</option><option value="plain">Lisa</option>
            </SelectField>
            <SelectField label="Ilustração" value={screen.artwork} onChange={value => change({ artwork: value as ClosureScreen['artwork'] })}>
              <option value="d2">Mascote D2</option><option value="tools">Manutenção</option><option value="sun">Sol</option>
              <option value="calendar">Calendário</option><option value="image">Imagem por link</option><option value="none">Sem ilustração</option>
            </SelectField>
          </div>
          {screen.artwork === 'image' && <label>Endereço HTTPS da imagem
            <input className="portal-control" type="url" maxLength={1000} value={screen.imageUrl} onChange={e => change({ imageUrl: e.target.value })} />
          </label>}
          <div className="agenda-closure-palettes" aria-label="Paletas">
            {closurePalettes.map(({ label, ...palette }) => <button type="button" key={label} className="portal-control"
              onClick={() => change(palette)}><span aria-hidden="true" style={{ backgroundColor: palette.background, borderColor: palette.accent }} />{label}</button>)}
          </div>
          <div className="agenda-closure-colors">
            {(Object.keys(colors) as (keyof typeof colors)[]).map(key => <label key={key}>
              <input type="color" value={screen[key]} onChange={e => change({ [key]: e.target.value })} />{colors[key]}
            </label>)}
          </div>
        </section>
        <section>
          <h3>Blocos</h3>
          <ol className="agenda-closure-block-list">
            {screen.blocks.map((block, index) => <li key={index} data-dragging={dragging === index}
              onDragOver={event => { if (dragging !== null) event.preventDefault() }}
              onDrop={event => { event.preventDefault(); if (dragging !== null) moveBlock(dragging, index); setDragging(null) }}>
              <div className="agenda-closure-block-bar">
                <span className="agenda-closure-grip" title="Arrastar bloco" draggable
                  onDragStart={event => { setDragging(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)) }}
                  onDragEnd={() => setDragging(null)}><GripVertical size={17} aria-hidden="true" /></span>
                <strong>{blockLabels[block.kind]}</strong>
                <button type="button" className="portal-control" aria-label={`Subir bloco ${index + 1}`} disabled={index === 0} onClick={() => moveBlock(index, index - 1)}><ArrowUp size={15} /></button>
                <button type="button" className="portal-control" aria-label={`Descer bloco ${index + 1}`} disabled={index === screen.blocks.length - 1} onClick={() => moveBlock(index, index + 1)}><ArrowDown size={15} /></button>
                <button type="button" className="portal-control" aria-label={`Remover bloco ${index + 1}`}
                  onClick={() => change({ blocks: screen.blocks.filter((_, at) => at !== index) })}><Trash2 size={15} /></button>
              </div>
              {(block.kind === 'text' || block.kind === 'callout') && <textarea className="portal-control"
                aria-label={`Texto do bloco ${index + 1}`} rows={3} maxLength={700} value={block.text} onChange={e => updateBlock(index, { text: e.target.value })} />}
              {(block.kind === 'link' || block.kind === 'heading') && <input className="portal-control"
                aria-label={`Texto do bloco ${index + 1}`} maxLength={80} value={block.text} onChange={e => updateBlock(index, { text: e.target.value })} />}
              {block.kind === 'link' && <label>Endereço HTTPS
                <input className="portal-control" type="url" maxLength={1000} value={block.url ?? ''} onChange={e => updateBlock(index, { url: e.target.value })} />
              </label>}
            </li>)}
          </ol>
          <div className="agenda-closure-add">
            <SelectField label="Tipo do bloco" value={newBlock} onChange={value => setNewBlock(value as ClosureBlock['kind'])}>
              {Object.entries(blockLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </SelectField>
            <button type="button" className="portal-control" disabled={screen.blocks.length >= 8}
              onClick={() => change({ blocks: [...screen.blocks, { kind: newBlock, text: '' }] })}><Plus size={16} aria-hidden="true" /> Adicionar</button>
          </div>
        </section>
      </fieldset>

      <section className="interface-panel agenda-closure-panel agenda-closure-preview">
        <div className="agenda-closure-controls">
          <h3>Prévia</h3>
          <div className="agenda-closure-actions">
            {settings.published && <button type="button" className="portal-control" aria-pressed={livePreview}
              onClick={() => setLivePreview(value => !value)}>{livePreview ? 'Ver edição' : 'Ver tela publicada'}</button>}
            <button type="button" className="portal-control" aria-label="Prévia em tela larga" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor size={18} /></button>
            <button type="button" className="portal-control" aria-label="Prévia no celular" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone size={18} /></button>
          </div>
        </div>
        <div className="agenda-closure-preview-frame" data-mobile={mobile}>
          <AgendaClosureScreen preview screen={(livePreview && settings.published) || screen} />
        </div>
      </section>
    </div>
  </div>
}
