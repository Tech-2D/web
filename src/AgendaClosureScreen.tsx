import type { CSSProperties } from 'react'
import { ArrowUpRight, CalendarDays, Sun, Wrench } from 'lucide-react'
import d2Avatar from './assets/d2/d2.webp'
import { closureHttpsUrl, type ClosureScreen } from './agendaClosure'
import './agendaClosure.css'

const icons = { tools: Wrench, sun: Sun, calendar: CalendarDays }

export function AgendaClosureScreen({ screen, preview = false }: { screen: ClosureScreen; preview?: boolean }) {
  const Heading = preview ? 'h3' : 'h1'
  const Subheading = preview ? 'h4' : 'h2'
  const image = screen.artwork === 'image' ? closureHttpsUrl(screen.imageUrl) : undefined
  const Icon = screen.artwork in icons ? icons[screen.artwork as keyof typeof icons] : null
  const hasArtwork = Boolean(image || Icon || screen.artwork === 'd2')

  return <article className="agenda-closure-screen" data-layout={screen.layout} data-texture={screen.texture}
    data-typeface={screen.typeface} data-artwork={hasArtwork} style={{
      '--closure-bg': screen.background, '--closure-fg': screen.foreground, '--closure-accent': screen.accent,
    } as CSSProperties}>
    {hasArtwork && <div className="agenda-closure-art" aria-hidden="true">
      {screen.artwork === 'd2' && <img src={d2Avatar} alt="" />}
      {Icon && <Icon strokeWidth={1.35} />}
      {image && <img className="agenda-closure-custom-image" src={image} alt="" referrerPolicy="no-referrer" />}
    </div>}
    <div className="agenda-closure-copy">
      {screen.label && <p className="agenda-closure-eyebrow">{screen.label}</p>}
      <Heading>{screen.title || (preview ? 'Título da tela' : '')}</Heading>
      {screen.blocks.length > 0 && <div className="agenda-closure-blocks">
        {screen.blocks.map((block, index) => {
          if (block.kind === 'divider') return <hr key={index} />
          if (block.kind === 'heading') return <Subheading key={index}>{block.text}</Subheading>
          if (block.kind === 'link') {
            const href = closureHttpsUrl(block.url)
            const label = <>{block.text || 'Texto do botão'} <ArrowUpRight size={17} aria-hidden="true" /></>
            return preview || !href
              ? <span className="agenda-closure-link" key={index}>{label}</span>
              : <a className="agenda-closure-link" key={index} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
          }
          return <p className={block.kind === 'callout' ? 'agenda-closure-callout' : undefined} key={index}>{block.text}</p>
        })}
      </div>}
    </div>
  </article>
}
