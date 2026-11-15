import { useEffect, useId, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { accessDateLabel, accessSiteIds, accessSiteLabels, formatAccessCount, type AccessDay } from './siteAccess'

export function SiteAccessChart({ rows }: { rows: AccessDay[] }) {
  const [view, setView] = useState<'total' | 'sites'>('total')
  const [selected, setSelected] = useState(rows.length - 1)
  const [width, setWidth] = useState(640)
  const container = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(entries => setWidth(Math.max(260, entries[0].contentRect.width)))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  const active = rows[selected]
  const series = view === 'total'
    ? [{ id: 'total', label: 'Total do portal', values: rows.map(row => row.total) }]
    : accessSiteIds.map(id => ({ id, label: accessSiteLabels[id], values: rows.map(row => row.sites[id]) }))
  const peak = Math.max(1, ...series.flatMap(line => line.values.map(value => value ?? 0)))
  const rawStep = peak / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 5, 10].find(value => value * magnitude >= rawStep)! * magnitude
  const interval = Math.max(1, step)
  const maximum = Math.ceil(peak / interval) * interval
  const height = 240
  const left = 40
  const right = width - 14
  const top = 16
  const bottom = height - 30
  const x = (index: number) => left + index * (right - left) / (rows.length - 1)
  const y = (value: number) => bottom - value / maximum * (bottom - top)
  const tickEvery = Math.ceil((rows.length - 1) / (width < 480 ? 3 : 6))
  const ticks = rows.flatMap((row, index) => index % tickEvery === 0 || index === rows.length - 1 ? [{ date: row.date, index }] : [])
  const available = rows.some(row => (row.total ?? 0) > 0)

  return (
    <section className="access-chart" aria-labelledby={titleId}>
      <div className="access-chart-heading">
        <div><h4 id={titleId}>Evolução dos acessos</h4><p id={descriptionId}>Acessos por dia, de {accessDateLabel(rows[0].date)} a {accessDateLabel(rows.at(-1)!.date)}.</p></div>
        <div className="interface-segments" role="group" aria-label="Visualização do gráfico">
          <button type="button" aria-pressed={view === 'total'} onClick={() => setView('total')}>Total do portal</button>
          <button type="button" aria-pressed={view === 'sites'} onClick={() => setView('sites')}>Por área</button>
        </div>
      </div>
      <div className="access-chart-readout">
        <time dateTime={active.date}>{accessDateLabel(active.date)}{selected === rows.length - 1 ? ' · hoje' : ''}</time>
        <ul aria-label="Acessos do dia selecionado">
          {series.map(line => <li key={line.id} className={'access-series access-series-' + line.id}>
            <span className="access-series-mark" aria-hidden="true" />
            <span>{line.label}</span><strong>{line.values[selected] === null ? 'Sem registro' : formatAccessCount(line.values[selected])}</strong>
          </li>)}
        </ul>
      </div>
      <div className="access-chart-plot" ref={container}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId} aria-describedby={descriptionId}
          onPointerMove={event => {
            const bounds = event.currentTarget.getBoundingClientRect()
            const position = (event.clientX - bounds.left) * width / bounds.width
            setSelected(Math.max(0, Math.min(rows.length - 1, Math.round((position - left) / (right - left) * (rows.length - 1)))))
          }}>
          {Array.from({ length: maximum / interval + 1 }, (_, index) => index * interval).map(value => (
            <g key={value} className="access-chart-grid">
              <line x1={left} x2={right} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{formatAccessCount(value)}</text>
            </g>
          ))}
          {ticks.map(({ date, index }) => <text className="access-chart-date" key={date} x={x(index)} y={height - 6}
            textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'}>{accessDateLabel(date)}</text>)}
          <line className="access-chart-cursor" x1={x(selected)} x2={x(selected)} y1={top} y2={bottom} />
          {series.map(line => {
            const path = line.values.map((value, index) => value === null ? '' :
              `${index === 0 || line.values[index - 1] === null ? 'M' : 'L'}${x(index)},${y(value)}`).join(' ')
            return <g key={line.id} className={'access-series access-series-' + line.id}>
              <path d={path} className="access-chart-line" />
              {line.values.map((value, index) => value === null ? null : (
                <circle key={index} cx={x(index)} cy={y(value)} r={index === selected ? 4.5 : 2.5} className="access-chart-point" />
              ))}
            </g>
          })}
        </svg>
      </div>
      {!available && <p className="site-access-note">Nenhum acesso registrado neste período.</p>}
      <div className="access-chart-controls">
        <button type="button" className="portal-control" aria-label="Dia anterior no gráfico" disabled={selected === 0} onClick={() => setSelected(value => value - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
        <input type="range" min={0} max={rows.length - 1} value={selected} onChange={event => setSelected(Number(event.target.value))}
          aria-label="Dia do gráfico" aria-valuetext={`${accessDateLabel(active.date)}, ${active.total === null ? 'sem registro' : formatAccessCount(active.total) + ' acessos'}`} />
        <button type="button" className="portal-control" aria-label="Próximo dia no gráfico" disabled={selected === rows.length - 1} onClick={() => setSelected(value => value + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
    </section>
  )
}
