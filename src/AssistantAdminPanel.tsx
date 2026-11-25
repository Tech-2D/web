import { useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { RefreshCw, Save } from 'lucide-react'
import { API_BASE } from './apiBase'
import { auth } from './firebase'
import { accessDateLabel, formatAccessCount } from './siteAccess'
import './siteAccess.css'
import './assistantAdmin.css'

type Config = { dailyLimit: number; version: number; updatedAt: string | null }
type DailyUsage = { date: string; messages: number }
type AssistantReport = {
  config: Config; today: string; trackedSince: string | null; activeAccounts: number; daily: DailyUsage[]
  ranking: { uid: string; name: string | null; email: string | null; className: string | null; messages: number; activeDays: number; lastUsed: string }[]
}

const endpoint = API_BASE + '/api/admin/assistant'

export function AssistantAdminPanel({ user }: { user: User }) {
  const [days, setDays] = useState(7)
  const [revision, refresh] = useState(0)
  const [report, setReport] = useState<AssistantReport | null>(null)
  const [limit, setLimit] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const current = () => !controller.signal.aborted && auth.currentUser?.uid === user.uid
    setLoading(true)
    setError('')
    setNotice('')
    async function load() {
      const token = await user.getIdToken()
      if (!current()) return
      const response = await fetch(`${endpoint}?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), redirect: 'error', cache: 'no-store',
      })
      if (!response.ok) throw new Error(response.status === 403 ? 'Sua conta não tem acesso a este painel.' : 'Não foi possível carregar os dados do D2.')
      const data: AssistantReport = await response.json()
      if (current()) { setReport(data); setLimit(String(data.config.dailyLimit)) }
    }
    void load().catch(error => {
      if (current()) {
        setReport(null)
        setError(error.message || 'Não foi possível carregar os dados do D2.')
      }
    }).finally(() => { if (current()) setLoading(false) })
    return () => controller.abort()
  }, [user, days, revision])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const dailyLimit = Number(limit)
    if (!report || saving || loading || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const token = await user.getIdToken()
      if (auth.currentUser?.uid !== user.uid) return
      const response = await fetch(endpoint, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyLimit, version: report.config.version }),
        signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store',
      })
      if (response.status === 409) throw new Error('O limite mudou em outra sessão. Clique em Atualizar antes de salvar de novo.')
      if (!response.ok) throw new Error('Não foi possível salvar o limite do D2. Atualize e tente novamente.')
      const { config }: { config: Config } = await response.json()
      if (auth.currentUser?.uid === user.uid) {
        setReport({ ...report, config })
        setLimit(String(config.dailyLimit))
        setNotice('Limite atualizado para as próximas mensagens.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar o limite.')
    } finally { setSaving(false) }
  }

  const total = report?.daily.reduce((sum, row) => sum + row.messages, 0) ?? 0
  const validLimit = Number.isInteger(Number(limit)) && Number(limit) >= 1 && Number(limit) <= 1000
  return <section className="site-access assistant-admin" aria-label="Uso e configuração do D2">
    <div className="site-access-toolbar">
      <h3>Uso do D2</h3>
      <label>Período <select value={days} disabled={saving} onChange={event => setDays(Number(event.target.value))}>
        <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option>
      </select></label>
      <button type="button" className="secondary-button" disabled={saving || loading} onClick={() => refresh(value => value + 1)}>
        <RefreshCw size={16} aria-hidden="true" /> Atualizar
      </button>
    </div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Carregando uso do D2…</p> : report && <>
      <form className="access-insight-section assistant-limit-form" onSubmit={save}>
        <div><h4>Limite diário por conta</h4>
          <p className="site-access-note">O saldo reinicia à meia-noite de Brasília. Contas isentas mantêm acesso ilimitado.</p></div>
        <div className="assistant-limit-fields">
          <label>Mensagens por dia <input type="number" min={1} max={1000} step={1} required value={limit} disabled={saving} onChange={event => setLimit(event.target.value)} /></label>
          <button className="primary-button compact" type="submit" disabled={saving || !validLimit || Number(limit) === report.config.dailyLimit}>
            <Save size={16} aria-hidden="true" /> {saving ? 'Salvando…' : 'Salvar limite'}
          </button>
        </div>
        {notice && <p className="site-access-note" role="status">{notice}</p>}
      </form>
      <div className="access-insight-metrics">
        <article><span>Mensagens no período</span><strong>{formatAccessCount(total)}</strong></article>
        <article><span>Mensagens hoje</span><strong>{formatAccessCount(report.daily.find(row => row.date === report.today)?.messages ?? 0)}</strong></article>
        <article><span>Contas ativas no período</span><strong>{formatAccessCount(report.activeAccounts)}</strong><small>Com mensagens registradas por conta</small></article>
      </div>
      <AssistantUsageChart days={report.daily} />
      <section className="access-insight-section" aria-labelledby="assistant-ranking-heading">
        <h4 id="assistant-ranking-heading">Contas que mais usam o D2</h4>
        {report.ranking.length ? <div className="access-table-scroll" role="region" aria-label="Ranking de uso do D2" tabIndex={0}>
          <table className="site-access-table access-users-table">
            <thead><tr><th scope="col">Conta</th><th scope="col">Mensagens</th><th scope="col">Dias ativos</th><th scope="col">Último uso</th></tr></thead>
            <tbody>{report.ranking.map(row => <tr key={row.uid}>
              <th scope="row"><strong>{row.email ?? row.name ?? row.uid}</strong>
                {(row.email && row.name || row.className) && <small>{[row.email && row.name, row.className].filter(Boolean).join(' · ')}</small>}
              </th>
              <td>{formatAccessCount(row.messages)}</td><td>{row.activeDays}</td><td>{accessDateLabel(row.lastUsed)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="site-access-note">Ainda não há registros por conta neste período.</p>}
        <p className="site-access-note">O ranking usa os registros por conta a partir da ativação da métrica{report.trackedSince ? ` (${accessDateLabel(report.trackedSince)})` : ''}.</p>
      </section>
    </>}
  </section>
}

function AssistantUsageChart({ days }: { days: DailyUsage[] }) {
  const maximum = Math.max(1, ...days.map(row => row.messages))
  const peak = days.find(row => row.messages === maximum)
  return <section className="access-insight-section" aria-labelledby="assistant-usage-heading">
    <h4 id="assistant-usage-heading">Mensagens por dia</h4>
    {peak && <p className="site-access-note">Pico no período · {formatAccessCount(peak.messages)} em {accessDateLabel(peak.date)}</p>}
    <div className="assistant-usage-bars" aria-hidden="true">{days.map(({ date, messages }) => (
      <div key={date} title={`${accessDateLabel(date)} · ${formatAccessCount(messages)} mensagens`}>
        <span style={{ height: `${messages / maximum * 100}%` }} />
      </div>
    ))}</div>
    <div className="assistant-usage-dates" aria-hidden="true">{[days[0], days.at(-1)].filter(Boolean).map(row => <span key={row!.date}>{accessDateLabel(row!.date)}</span>)}</div>
    <details className="access-daily-details"><summary>Ver valores por dia</summary>
      <div className="access-table-scroll"><table className="site-access-table assistant-usage-table">
        <thead><tr><th scope="col">Dia</th><th scope="col">Mensagens</th></tr></thead>
        <tbody>{[...days].reverse().map(row => <tr key={row.date}><th scope="row">{accessDateLabel(row.date)}</th><td>{formatAccessCount(row.messages)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </section>
}
