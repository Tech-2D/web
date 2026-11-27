import { useState } from 'react'
import { ArrowUpRight, BarChart3, Target } from 'lucide-react'
import { describeTarget, fmt, type NotesResult } from '../lib/grades'
import type { SummaryRow } from './Summary'
import './gradeAnalysis.css'

type Sort = 'name' | 'up' | 'down'
const rounded = (value: number) => Math.round(value * 100) / 100
const deltaLabel = (value: number) => (value > 0 ? '+' : '') + fmt(value)
const gradeAverage = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

function studyPriority(result: NotesResult) {
  if (result.situation === 'recuperacao' && result.needed !== null) return {
    order: 30 + result.needed,
    label: result.needed > 10 ? 'A média anual exige mais de 10 na recuperação final.' :
      `Meta na recuperação final de ${fmt(result.needed)}.`,
  }
  if (result.situation !== 'andamento' || !result.target) return null
  if (result.target.min === null) return { order: 20, label: 'Mesmo com 10 nas avaliações restantes, a média anual fica abaixo de 7.' }
  if (result.target.min === 0) return null
  return { order: result.target.min, label: describeTarget(result.target) + '.' }
}

function SemesterBar({ semester, value }: { semester: 1 | 2; value: number | null }) {
  return <div className="grade-analysis-bar" data-semester={semester}>
    <span className="grade-analysis-bar-label">{semester}º</span>
    <span className="grade-analysis-track" aria-hidden="true">
      {value !== null && <span style={{ width: (value * 10) + '%' }} />}
    </span>
    <span className="grade-analysis-bar-value">{value === null ? 'Pendente' : fmt(value)}</span>
  </div>
}

export function GradeAnalysis({ rows, onOpen, onGradeEntry }: {
  rows: SummaryRow[]; onOpen: (name: string) => void; onGradeEntry: () => void
}) {
  const [sort, setSort] = useState<Sort>('name')
  const comparisons = rows.filter(({ r }) => r.m1 !== null || r.m2 !== null).map(({ name, r }) => ({
    name, r, delta: r.m1 !== null && r.m2 !== null ? rounded(r.m2 - r.m1) : null,
  }))
  const first = comparisons.flatMap(({ r }) => r.m1 === null ? [] : [r.m1])
  const second = comparisons.flatMap(({ r }) => r.m2 === null ? [] : [r.m2])
  const paired = comparisons.flatMap(({ delta }) => delta === null ? [] : [delta])
  const averageDelta = gradeAverage(paired)
  const priorities = rows.flatMap(({ name, r }) => {
    const priority = studyPriority(r)
    return priority ? [{ name, ...priority }] : []
  }).sort((left, right) => right.order - left.order).slice(0, 4)
  comparisons.sort((left, right) => {
    if (sort === 'name') return left.name.localeCompare(right.name, 'pt-BR')
    if (left.delta === null || right.delta === null) return Number(left.delta === null) - Number(right.delta === null)
    return sort === 'up' ? right.delta - left.delta : left.delta - right.delta
  })

  return <div className="grade-analysis">
    <section className="interface-panel grade-analysis-panel" aria-labelledby="grade-analysis-title">
      <div className="grade-analysis-heading">
        <span className="grade-analysis-icon"><BarChart3 size={20} aria-hidden="true" /></span>
        <div><h2 id="grade-analysis-title">Minha evolução</h2>
          <p>Compare suas médias e veja como foi seu desempenho em cada semestre.</p></div>
      </div>
      <dl className="grade-analysis-stats">
        <div><dt>Média do 1º semestre</dt><dd>{fmt(gradeAverage(first))}<small>{first.length} de {rows.length} disciplinas com média</small></dd></div>
        <div><dt>Média do 2º semestre</dt><dd>{fmt(gradeAverage(second))}<small>{second.length} de {rows.length} disciplinas com média</small></dd></div>
        <div><dt>Variação média</dt><dd>{averageDelta === null ? '—' : deltaLabel(rounded(averageDelta))}
          <small>{paired.length ? `${paired.length} ${paired.length === 1 ? 'disciplina com as duas médias' : 'disciplinas com as duas médias'}` : 'Disponível quando houver uma disciplina com as duas médias'}</small></dd></div>
      </dl>
    </section>

    {priorities.length > 0 && <section className="interface-panel grade-analysis-panel" aria-labelledby="grade-analysis-priorities">
      <div className="grade-analysis-heading">
        <span className="grade-analysis-icon"><Target size={20} aria-hidden="true" /></span>
        <div><h2 id="grade-analysis-priorities">Prioridades de estudo</h2><p>Disciplinas que pedem mais atenção pelas notas lançadas.</p></div>
      </div>
      <ul className="grade-analysis-priorities">
        {priorities.map(({ name, label }) => <li key={name}>
          <button className="portal-control grade-analysis-priority" type="button" onClick={() => onOpen(name)}>
            <span><strong>{name}</strong><small>{label}</small></span><ArrowUpRight size={17} aria-hidden="true" />
          </button>
        </li>)}
      </ul>
    </section>}

    <section className="interface-panel grade-analysis-panel" aria-labelledby="grade-analysis-chart">
      <div className="grade-analysis-chart-header">
        <div><h2 id="grade-analysis-chart">Comparativo por disciplina</h2>
          <p>As barras mostram as médias de 0 a 10. A variação compara os dois semestres.</p></div>
        {comparisons.length > 0 && <label>Ordenar por
          <select className="portal-control" value={sort} onChange={event => setSort(event.target.value as Sort)}>
            <option value="name">Disciplina</option><option value="up">Maior avanço</option><option value="down">Maior queda</option>
          </select>
        </label>}
      </div>
      {comparisons.length ? <ul className="grade-analysis-comparison">
        {comparisons.map(({ name, r, delta }) => <li key={name} className="grade-analysis-row">
          <button type="button" className="grade-analysis-subject" onClick={() => onOpen(name)}>{name}<ArrowUpRight size={15} aria-hidden="true" /></button>
          <div className="grade-analysis-bars">
            <SemesterBar semester={1} value={r.m1} />
            <SemesterBar semester={2} value={r.m2} />
          </div>
          {delta !== null && <span className="grade-analysis-delta" data-trend={delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable'}
            aria-label={`Variação de ${deltaLabel(delta)} pontos`}>{deltaLabel(delta)}</span>}
        </li>)}
      </ul> : <div className="grade-analysis-empty">
        <p>Lance as notas de pelo menos um semestre em uma disciplina para ver a primeira média aqui.</p>
        <button type="button" className="portal-control" onClick={onGradeEntry}>Lançar notas</button>
      </div>}
    </section>
  </div>
}
