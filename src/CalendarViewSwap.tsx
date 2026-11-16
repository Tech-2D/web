import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CALENDAR_VIEWS, type CalendarView } from './calendarViews'
import { FADE, LEAD, TRAIL } from './pegaki/components/Segmented'
import './calendarViewSwap.css'

const ORDER = CALENDAR_VIEWS.map(view => view.id)
// Mesmos tempos da troca N1/N2 ↔ Média das Notas: a saída leva 260ms e a entrada (110ms + 560ms) termina depois dela.
const EXIT_MS = 260
const ENTER_MS = 110 + 560

/**
 * Seletor Dia/Semana/Mês com o fundo "líquido" do seletor das Notas: ele mede o botão escolhido e desliza até ele,
 * com a borda da frente indo na frente e um quique no fim.
 */
export function CalendarViewSwitch({ value, onChange }: { value: CalendarView; onChange: (view: CalendarView) => void }) {
  const track = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<CalendarView, HTMLButtonElement>())
  const [box, setBox] = useState<{ x: number; y: number; h: number; right: number } | null>(null)
  const [dir, setDir] = useState<1 | -1>(1)
  const lastX = useRef<number | null>(null)
  // Só anima depois da primeira medida: na montagem o fundo já nasce no lugar certo.
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const measure = () => {
      const el = buttons.current.get(value)
      if (!el || !track.current) return setBox(null)
      const x = el.offsetLeft
      if (lastX.current !== null && x !== lastX.current) setDir(x > lastX.current ? 1 : -1)
      lastX.current = x
      setBox({ x, y: el.offsetTop, h: el.offsetHeight, right: track.current.clientWidth - x - el.offsetWidth })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // A largura dos botões muda quando a fonte termina de carregar.
    const observer = new ResizeObserver(measure)
    if (track.current) observer.observe(track.current)
    buttons.current.forEach(button => observer.observe(button))
    return () => observer.disconnect()
  }, [value])

  useLayoutEffect(() => {
    if (!box || ready) return
    const timer = window.setTimeout(() => setReady(true), 50)
    return () => window.clearTimeout(timer)
  }, [box, ready])

  return <div ref={track} className="calendar-view-switch interface-segments liquid-switch" role="group" aria-label="Visualização da agenda">
    <span
      aria-hidden="true"
      className="liquid-switch-indicator"
      style={{
        left: box?.x ?? 0,
        right: box?.right ?? 0,
        top: box?.y ?? 0,
        height: box?.h ?? 0,
        opacity: box ? 1 : 0,
        transition: ready ? (dir === 1 ? `right ${LEAD}, left ${TRAIL}, ${FADE}` : `left ${LEAD}, right ${TRAIL}, ${FADE}`) : 'none',
      }}
    />
    {CALENDAR_VIEWS.map(view => {
      const active = view.id === value
      return <button
        key={view.id}
        ref={element => { if (element) buttons.current.set(view.id, element); else buttons.current.delete(view.id) }}
        type="button"
        aria-pressed={active}
        onClick={() => onChange(view.id)}
      >
        {/* O rótulo escolhido dá um "pulo" quando o fundo chega nele. */}
        <span key={active ? 'on' : 'off'} className={active && ready ? 'liquid-switch-pop' : undefined}>{view.label}</span>
      </button>
    })}
  </div>
}

/**
 * Troca o conteúdo da agenda como a troca de modo das Notas: a visão antiga sai para um lado e a nova entra pelo outro,
 * com mola e um leve desfoque. Indo para a direita no seletor (Dia → Semana → Mês), tudo anda para a esquerda.
 * Nada anima na montagem nem ao navegar pelas setas.
 */
export function CalendarViewSwap({ view, children }: { view: CalendarView; children: (view: CalendarView) => ReactNode }) {
  const [shown, setShown] = useState(view)
  const [leaving, setLeaving] = useState<{ view: CalendarView; height: number } | null>(null)
  const [enterFrom, setEnterFrom] = useState<'left' | 'right' | null>(null)
  const [swaps, setSwaps] = useState(0)
  const pane = useRef<HTMLDivElement>(null)
  const paneHeight = useRef(0)

  // A troca é detectada durante a renderização para que a visão nova já pinte com a animação, sem um quadro "seco".
  if (view !== shown) {
    setShown(view)
    setLeaving({ view: shown, height: paneHeight.current })
    setEnterFrom(ORDER.indexOf(view) > ORDER.indexOf(shown) ? 'right' : 'left')
    setSwaps(count => count + 1)
  }

  useLayoutEffect(() => {
    const element = pane.current
    if (!element) return
    paneHeight.current = element.offsetHeight
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { paneHeight.current = element.offsetHeight })
    observer.observe(element)
    return () => observer.disconnect()
  }, [shown])

  useEffect(() => {
    if (!swaps) return
    const exit = window.setTimeout(() => setLeaving(null), EXIT_MS)
    // Tira a classe ao fim da entrada para o painel não ficar com transformação aplicada.
    const enter = window.setTimeout(() => setEnterFrom(null), ENTER_MS)
    return () => { window.clearTimeout(exit); window.clearTimeout(enter) }
  }, [swaps])

  return <div className="view-swap">
    {/* A key remonta a visão a cada troca, para a animação de entrada rodar de novo. */}
    <div key={shown} ref={pane} className={`view-swap-pane${enterFrom ? ` view-swap-in-${enterFrom}` : ''}`}>{children(shown)}</div>
    {leaving && <div
      aria-hidden="true"
      inert
      className={`view-swap-pane view-swap-leaving view-swap-out-${enterFrom === 'right' ? 'left' : 'right'}`}
      style={{ height: leaving.height || undefined }}
    >
      {children(leaving.view)}
    </div>}
  </div>
}
