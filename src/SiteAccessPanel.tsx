import { useEffect, useState } from 'react'
import { Activity, RefreshCw, TrendingUp } from 'lucide-react'
import type { User } from 'firebase/auth'
import { SQL_BASE } from './dataBackend'
import { auth } from './firebase'
import { SiteAccessChart } from './SiteAccessChart'
import { AccessUsageInsights } from './AccessUsageInsights'
import { accessCount, accessDateLabel, accessSiteIds, accessSiteLabels, accessTimeline, formatAccessCount, type AccessStatistics } from './siteAccess'
import './siteAccess.css'

export function SiteAccessPanel({ user }: { user: User }) {
  const [days, setDays] = useState(7)
  const [revision, refresh] = useState(0)
  const [result, setResult] = useState<AccessStatistics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const isCurrent = () => !controller.signal.aborted && auth.currentUser?.uid === user.uid
    setResult(null)
    setError('')

    async function load() {
      const token = await user.getIdToken()
      if (!isCurrent()) return
      const response = await fetch(SQL_BASE + '/api/admin/site-access?days=' + days, {
        headers: { Authorization: 'Bearer ' + token },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        redirect: 'error',
        cache: 'no-store',
      })
      if (!isCurrent()) return
      if (response.status === 401) return setError('Entre novamente para consultar os acessos.')
      if (response.status === 403) return setError('Esta conta não tem acesso às estatísticas.')
      if (!response.ok) throw new Error('ACCESS_STATS_UNAVAILABLE')
      const data: AccessStatistics = await response.json()
      if (isCurrent()) setResult(data)
    }
    void load().catch(() => {
      if (isCurrent()) setError('Não foi possível carregar os acessos. Tente atualizar.')
    })
    return () => controller.abort()
  }, [user, days, revision])

  const timeline = result ? accessTimeline(result, days) : []
  const total = timeline.reduce((sum, day) => sum + (day.total ?? 0), 0)
  const today = timeline.at(-1)?.total ?? 0
  const measured = timeline.filter(day => day.total !== null)
  const peak = measured.reduce<(typeof timeline)[number] | undefined>((best, day) => !best || day.total! > best.total! ? day : best, undefined)
  const sites = accessSiteIds.filter(site => result?.sites[site])

  return (
    <section className="site-access" aria-labelledby="site-access-heading">
      <div className="site-access-toolbar">
        <h3 id="site-access-heading">Acessos ao portal</h3>
        <label>Período
          <select value={days} onChange={event => setDays(Number(event.target.value))}>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
        </label>
        <button type="button" className="secondary-button" disabled={!result && !error} onClick={() => refresh(n => n + 1)}><RefreshCw size={16} aria-hidden="true" /> Atualizar</button>
      </div>
      {error ? <p role="alert">{error}</p> : !result ? <p role="status">Carregando acessos…</p> : <>
        <div className="access-overview">
          <div className="access-overview-total"><span><Activity size={17} aria-hidden="true" /> Acessos no período</span><strong>{formatAccessCount(total)}</strong><small>{accessDateLabel(timeline[0].date)} a {accessDateLabel(result.today)}</small></div>
          <dl>
            <div><dt>Hoje</dt><dd>{formatAccessCount(today)}</dd></div>
            <div><dt>Média diária</dt><dd>{measured.length ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(total / measured.length) : '—'}</dd><small className="access-average-note">nos dias com cobertura</small></div>
            <div><dt><TrendingUp size={14} aria-hidden="true" /> Dia com mais acessos</dt><dd>{peak?.total ? <>{accessDateLabel(peak.date)} <small>· {formatAccessCount(peak.total)}</small></> : '—'}</dd></div>
          </dl>
        </div>
        <SiteAccessChart key={days + ':' + revision} rows={timeline} />
        <div className="site-access-summary">
          {sites.map(site => {
            const stats = result.sites[site]
            if (!stats) return null
            const { total, daily } = stats
            return (
              <div className={`site-access-card access-series access-series-${site}`} key={site}>
                <h4><span className="access-series-mark" aria-hidden="true" />{accessSiteLabels[site]}</h4>
                <strong>{formatAccessCount(accessCount(total))} <span>acessos</span></strong>
                <small>{formatAccessCount(accessCount(daily.find(row => row.date === result.today)))} hoje · {formatAccessCount(total.accounts)} contas no período</small>
                <small>{formatAccessCount(total.authenticated)} com login · {formatAccessCount(total.anonymous)} anônimos no histórico</small>
              </div>
            )
          })}
        </div>
        {result.analytics && <AccessUsageInsights data={result.analytics} total={total} days={days} />}
        <details className="access-daily-details">
          <summary>Ver acessos por dia</summary>
          <div className="access-table-scroll" role="region" aria-label="Tabela de acessos diários" tabIndex={0}>
          <table className="site-access-table">
          <caption>Acessos por dia · — indica período sem registros disponíveis</caption>
          <thead><tr><th scope="col">Dia</th><th scope="col">Total</th>{sites.map(site => <th key={site} scope="col">{accessSiteLabels[site]}</th>)}</tr></thead>
          <tbody>{[...timeline].reverse().map(row => <tr key={row.date}>
            <th scope="row"><time dateTime={row.date}>{accessDateLabel(row.date)}</time></th>
            <td>{row.total === null ? '—' : formatAccessCount(row.total)}</td>
            {sites.map(site => (
              <td key={site}>{row.sites[site] === null ? '—' : formatAccessCount(row.sites[site])}</td>
            ))}
          </tr>)}</tbody>
          </table>
          </div>
        </details>
        <p className="site-access-note">{result.professorSince && <>Comparativo entre Agenda e Professores disponível desde {accessDateLabel(result.professorSince)}. </>}
          {result.pegakiSince && <>Notas desde {accessDateLabel(result.pegakiSince)}. </>}A tabela indica os períodos sem registros.</p>
      </>}
      <p className="site-access-note">Uma conta pode gerar um acesso a cada 30 minutos em cada área. Datas seguem Brasília. Kanban é contabilizado junto à Agenda.</p>
    </section>
  )
}
