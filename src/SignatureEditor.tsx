import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AlignCenter, AlignLeft, Download, ImagePlus, PenLine, Trash2 } from 'lucide-react'
import { PageHeading } from './PageHeading'
import { drawSignature, type SignatureDraft } from './signatureCanvas'
import './signatureEditor.css'

const initial: SignatureDraft = {
  name: '', role: '', organization: '', email: '', phone: '', website: '', extra: '',
  layout: 'side', font: 'Arial', accent: '#0a2dc4', text: '#202e47', background: '#ffffff', transparent: false,
}

const fields = [
  { key: 'name', label: 'Nome', placeholder: 'Seu nome completo', max: 100, autoComplete: 'name' },
  { key: 'role', label: 'Cargo ou área', placeholder: 'Ex.: Analista de projetos', max: 100, autoComplete: 'organization-title' },
  { key: 'organization', label: 'Empresa ou instituição', placeholder: 'Nome da instituição', max: 100, autoComplete: 'organization' },
  { key: 'email', label: 'E-mail', placeholder: 'nome@empresa.com.br', max: 120, autoComplete: 'email', inputMode: 'email' },
  { key: 'phone', label: 'Telefone', placeholder: '(11) 99999-9999', max: 45, autoComplete: 'tel', inputMode: 'tel' },
  { key: 'website', label: 'Site ou link', placeholder: 'www.empresa.com.br', max: 150, autoComplete: 'url', inputMode: 'url' },
  { key: 'extra', label: 'Linha adicional', placeholder: 'Ex.: Departamento ou endereço', max: 180 },
] as const

export function SignatureEditor() {
  const [draft, setDraft] = useState(initial)
  const [picture, setPicture] = useState<{ image: HTMLImageElement; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)

  function change<K extends keyof SignatureDraft>(key: K, value: SignatureDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }))
    setStatus('')
    setError('')
  }

  useEffect(() => {
    if (canvas.current) drawSignature(canvas.current, draft, picture?.image ?? null, true)
  }, [draft, picture])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setStatus('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Escolha uma imagem PNG, JPG ou WebP de até 5 MB.')
      return
    }

    setUploading(true)
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      if (image.naturalWidth * image.naturalHeight > 20_000_000) {
        throw new Error('A imagem é muito grande. Reduza suas dimensões e tente novamente.')
      }
      setPicture({ image, name: file.name })
    } catch (cause) {
      setError(cause instanceof Error && cause.message.startsWith('A imagem é muito grande') ? cause.message : 'Não foi possível abrir a imagem. Tente outro arquivo.')
    } finally {
      URL.revokeObjectURL(url)
      setUploading(false)
    }
  }

  async function download() {
    if (!draft.name.trim() || uploading || exporting) return
    setError('')
    setStatus('')
    setExporting(true)
    try {
      const output = document.createElement('canvas')
      if (!drawSignature(output, draft, picture?.image ?? null)) throw new Error('Canvas indisponível')
      const png = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'))
      if (!png) throw new Error('PNG indisponível')

      const fileName = draft.name.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
      const url = URL.createObjectURL(png)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName ? 'assinatura-' + fileName + '.png' : 'assinatura.png'
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

  return (
    <main className="signature-page portal-main" aria-label="Editor de assinatura de e-mail">
      <div className="signature-heading interface-panel">
        <PageHeading icon={PenLine} title="Assinatura de e-mail" description="Crie sua assinatura para o Outlook e baixe a imagem em PNG." />
        <a className="signature-preview-link" href="#signature-preview">Ver prévia e baixar</a>
      </div>
      <div className="signature-workspace">
        <section className="signature-controls interface-panel" aria-labelledby="signature-details">
          <h2 id="signature-details">Dados da assinatura</h2>
          <div className="signature-fields">
            {fields.map(field => (
              <label key={field.key}>
                {field.label}
                <input
                  value={draft[field.key]}
                  onChange={event => change(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.max}
                  autoComplete={'autoComplete' in field ? field.autoComplete : undefined}
                  inputMode={'inputMode' in field ? field.inputMode : undefined}
                  required={field.key === 'name'}
                />
              </label>
            ))}
          </div>
          <fieldset className="signature-style">
            <legend>Aparência</legend>
            <div className="signature-fields">
              <div className="signature-layout">
                <span>Layout</span>
                <div role="group" aria-label="Layout da assinatura">
                  <button type="button" aria-pressed={draft.layout === 'side'} onClick={() => change('layout', 'side')}><AlignLeft size={16} /> Lateral</button>
                  <button type="button" aria-pressed={draft.layout === 'stack'} onClick={() => change('layout', 'stack')}><AlignCenter size={16} /> Centralizado</button>
                </div>
              </div>
              <label>Fonte
                <select value={draft.font} onChange={event => change('font', event.target.value as SignatureDraft['font'])}>
                  <option>Arial</option><option>Georgia</option><option>Verdana</option>
                </select>
              </label>
            </div>
            <div className="signature-colors">
              <label><input type="color" value={draft.accent} onChange={event => change('accent', event.target.value)} /> Destaque</label>
              <label><input type="color" value={draft.text} onChange={event => change('text', event.target.value)} /> Texto</label>
              <label><input type="color" value={draft.background} onChange={event => change('background', event.target.value)} disabled={draft.transparent} /> Fundo</label>
              <label><input type="checkbox" checked={draft.transparent} onChange={event => change('transparent', event.target.checked)} /> Fundo transparente</label>
            </div>
          </fieldset>
          <fieldset className="signature-style">
            <legend>Logo ou foto <small>Opcional</small></legend>
            <div className="signature-image">
              <label className="secondary-button signature-upload">
                <ImagePlus size={17} /> {uploading ? 'Carregando…' : picture ? 'Trocar imagem' : 'Escolher imagem'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={uploading || exporting} />
              </label>
              {picture && <>
                <span>{picture.name}</span>
                <button type="button" className="secondary-button" disabled={uploading || exporting} onClick={() => { setPicture(null); setStatus(''); setError('') }}>
                  <Trash2 size={16} /> Remover
                </button>
              </>}
            </div>
            <p className="signature-muted">PNG, JPG ou WebP de até 5 MB.</p>
          </fieldset>
        </section>
        <section className="signature-preview interface-panel" aria-labelledby="signature-preview">
          <h2 id="signature-preview">Prévia da assinatura</h2>
          <div className="signature-paper">
            <div className="signature-mail"><span>Novo e-mail</span><span>Outlook</span></div>
            <div className="signature-proof">
              <canvas ref={canvas} role="img" aria-label={[draft.name.trim() || 'Seu nome', draft.role, draft.organization, draft.email, draft.phone, draft.website, draft.extra].filter(Boolean).join(' · ')} />
            </div>
          </div>
          <div className="signature-export">
            <button type="button" className="primary-button" onClick={download} disabled={!draft.name.trim() || uploading || exporting}>
              <Download size={18} /> {exporting ? 'Gerando PNG…' : 'Baixar PNG'}
            </button>
            {!draft.name.trim() && <p className="signature-muted">Preencha seu nome para baixar.</p>}
          </div>
          {error && <p className="signature-message" role="alert">{error}</p>}
          {status && <p className="signature-message" role="status">{status}</p>}
        </section>
      </div>
    </main>
  )
}
