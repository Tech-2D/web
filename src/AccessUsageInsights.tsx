import { useState } from 'react'
import { accessDateLabel, accessSiteLabels, formatAccessCount as count, type AccessSiteId, type UsageAnalytics } from './siteAccess'

const decimal = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)
const percent = (part: number, total: number) => decimal(total ? part / total * 100 : 0) + '%'

export function AccessUsageInsights({ data, total, days, sites }: { data: UsageAnalytics; total: number; days: number; sites: AccessSiteId[] }) {
  const [order, setOrder] = useState<'accesses' | 'accounts'>('accesses')
  const classes = [...data.classes].sort((a,b) => b[order] - a[order] || b.accesses - a.accesses || a.className.localeCompare(b.className))
  const max = Math.max(1,...classes.map(row => row[order]))
  return <>
    <div className="access-insight-metrics">
      <article><span>Contas ativas</span><strong>{count(data.activeUsers)}</strong><small>Contas distintas que acessaram pelo menos uma área do portal.</small></article>
      <article><span>Voltaram em outro dia</span><strong>{count(data.returningUsers)} <small>· {percent(data.returningUsers,data.activeUsers)}</small></strong><small>Contas que usaram o sistema em pelo menos dois dias do período.</small></article>
      <article><span>Acessos por conta ativa</span><strong>{data.activeUsers ? decimal(data.authenticatedAccesses / data.activeUsers) : '—'}</strong><small>Considera apenas acessos autenticados.</small></article>
      <article><span>Comparação com os {days} dias anteriores</span><strong>{data.previous.available ? (data.previous.accesses ? (total >= data.previous.accesses ? '+' : '') + decimal((total - data.previous.accesses) / data.previous.accesses * 100) + '%' : '—') : '—'}</strong><small>{data.previous.available ? `${count(data.previous.accesses)} acessos e ${count(data.previous.accounts)} contas no período anterior.` : 'Ainda não há cobertura para comparar os períodos completos.'}</small></article>
    </div>
    <section className="access-insight-section" aria-labelledby="access-classes-title">
      <div className="access-chart-heading"><div><h4 id="access-classes-title">Uso por turma</h4><p>Compare o alcance e a frequência de uso de cada turma.</p></div>
        <label>Ordenar por <select value={order} onChange={event => setOrder(event.target.value as typeof order)}><option value="accesses">Mais acessos</option><option value="accounts">Mais contas ativas</option></select></label>
      </div>
      {!classes.length ? <p className="admin-empty">Nenhum acesso autenticado neste período.</p> : <div className="access-class-list">{classes.map((row, index) => <article key={`${row.className}-${index}`}>
        <div className="access-class-label"><strong>{row.className}</strong><span>{count(row.accesses)} acessos · {count(row.accounts)} contas ativas</span></div>
        <div className="access-class-track" aria-hidden="true"><span style={{width: `${row[order] / max * 100}%`}} /></div>
        <p>{percent(row.accesses,data.authenticatedAccesses)} dos acessos com login · {decimal(row.accesses / row.accounts)} acessos por conta · {decimal(row.activeDays / row.accounts)} dias por conta</p>
        <small>{sites.map(site => `${accessSiteLabels[site]}: ${count(row.sites[site])}`).join(' · ')}</small>
      </article>)}</div>}
      <p className="site-access-note">A turma vem do perfil, da preferência de resumo semanal ou do cadastro de representante, nesta ordem. Rótulos reconhecidos são agrupados pelo catálogo. Contas sem essa informação aparecem separadas. É a turma atual da conta, inclusive para acessos anteriores.</p>
    </section>
    <section className="access-insight-section" aria-labelledby="access-users-title">
      <div className="access-chart-heading"><div><h4 id="access-users-title">Quem mais usa o sistema</h4><p>Até 10 contas, ordenadas por acessos e depois por dias de uso.</p></div></div>
      {!data.topUsers.length ? <p className="admin-empty">Nenhuma conta com acesso no período.</p> : <div className="access-table-scroll" role="region" aria-label="Usuários mais ativos" tabIndex={0}><table className="site-access-table access-users-table">
        <thead><tr><th scope="col">Pessoa / turma</th><th scope="col">Acessos</th><th scope="col">Dias ativos</th>{sites.map(site => <th scope="col" key={site}>{accessSiteLabels[site]}</th>)}<th scope="col">Último acesso</th></tr></thead>
        <tbody>{data.topUsers.map((row,index) => <tr key={row.uid}>
          <th scope="row">
            <strong>{index + 1}. {row.name || row.email || 'Conta sem identificação no perfil'}</strong>
            {row.name && row.email && <small>{row.email}</small>}
            <small>{row.className}</small>
            {!row.email && <small>UID: {row.uid}</small>}
          </th>
          <td>{count(row.accesses)}</td><td>{count(row.activeDays)}</td>
          {sites.map(site => <td key={site}>{count(row.sites[site])}</td>)}
          <td><time dateTime={row.lastVisit}>{accessDateLabel(row.lastVisit)}</time></td>
        </tr>)}</tbody>
      </table></div>}
      <p className="site-access-note">Frequência de acesso indica uso, sem medir tempo de permanência ou resultado nos estudos. A lista considera somente contas autenticadas e fica restrita aos superadministradores.</p>
    </section>
  </>
}
