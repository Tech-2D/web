import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, Edit3, LoaderCircle, Plus, Trash2, Upload, UserRound, X } from 'lucide-react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, writeBatch } from './dataClient'
import { db } from './firebase'
import { invalidateCatalog } from './publicQueries'
import { importDocumentId, parseSchedulesJson } from './professores/importSchedules'
import { matchesSearch, timeToMinutes } from './professores/schedule'
import { WEEKDAYS, type Schedule, type ScheduleInput } from './professores/types'
import { CLASS_NAMES } from './professores/classNames'
import './schedulesAdmin.css'

const emptyForm: ScheduleInput = { professor: '', subject: '', className: '', floor: '', roomDescription: '', startTime: '08:00', endTime: '09:00', dayOfWeek: 1, active: true }

export function SchedulesAdminPanel({ view, classNames }: { view: 'schedules' | 'import'; classNames: string[] }) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [form, setForm] = useState<ScheduleInput>(emptyForm)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [adminPage, setAdminPage] = useState(1)
  const [importRows, setImportRows] = useState<ScheduleInput[]>([])
  const [importError, setImportError] = useState('')
  const [importProgress, setImportProgress] = useState('')
  const adminSection = view
  const filteredAdminSchedules = useMemo(() => schedules.filter(item => matchesSearch(item, adminSearch)), [schedules, adminSearch])
  const pageSize = 30
  const totalPages = Math.max(1, Math.ceil(filteredAdminSchedules.length / pageSize))
  const page = Math.min(adminPage, totalPages)
  const pageStart = (page - 1) * pageSize
  const pageSchedules = filteredAdminSchedules.slice(pageStart, pageStart + pageSize)
  const availableClasses = [...new Set([...CLASS_NAMES, ...classNames, form.className].filter(Boolean))]

  useEffect(() => onSnapshot(query(collection(db, 'schedules')), snapshot => {
    setSchedules(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Schedule))
    setLoading(false); setLoadError('')
  }, () => { setLoading(false); setLoadError('Não foi possível carregar os horários. Confira sua conexão e tente abrir esta seção novamente.') }), [])

  function startCreate() {
    setEditing(null)
    setForm({ ...emptyForm, dayOfWeek: new Date().getDay() || 1 })
    setSaveError('')
    setFormOpen(true)
  }

  function startEdit(schedule: Schedule) {
    const { id: _id, ...values } = schedule
    void _id
    setEditing(schedule)
    setForm(values)
    setSaveError('')
    setFormOpen(true)
  }

  async function saveSchedule(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setSaveError('')
    try {
      if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
        throw new Error('O horário final precisa ser depois do horário inicial.')
      }
      if (editing) {
        await updateDoc(doc(db, 'schedules', editing.id), { ...form, updatedAt: serverTimestamp() })
        setNotice('Horário atualizado.')
      } else {
        await addDoc(collection(db, 'schedules'), { ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        setNotice('Horário adicionado.')
      }
      setFormOpen(false)
      if (!await invalidateCatalog('schedules')) setNotice('Horário salvo. A consulta pública será atualizada na próxima renovação do cache.')
      window.setTimeout(() => setNotice(''), 2800)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar o horário.')
    } finally {
      setBusy(false)
    }
  }

  async function removeSchedule(schedule: Schedule) {
    if (busy || !window.confirm(`Excluir o horário de ${schedule.professor}?`)) return
    setBusy(true)
    try {
      await deleteDoc(doc(db, 'schedules', schedule.id))
      await invalidateCatalog('schedules')
      setNotice('Horário excluído.')
      window.setTimeout(() => setNotice(''), 2800)
    } catch {
      setNotice('Não foi possível excluir o horário.')
    } finally { setBusy(false) }
  }

  async function readImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setImportRows([])
    setImportError('')
    setImportProgress('')
    if (!file) return
    try {
      const rows = parseSchedulesJson(await file.text())
      setImportRows(rows)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.')
    }
  }

  async function importSchedules() {
    if (importRows.length === 0) return
    setBusy(true)
    setImportError('')
    let processed = 0
    try {
      const existingById = new Map(schedules.map((schedule) => [schedule.id, schedule]))
      const pending: { id: string; schedule: ScheduleInput; updateActive: boolean }[] = []
      for (const schedule of importRows) {
        const id = await importDocumentId(schedule)
        const existing = existingById.get(id)
        if (!existing || existing.active !== schedule.active) pending.push({ id, schedule, updateActive: Boolean(existing) })
      }
      if (pending.length === 0) {
        setNotice('Todos os horários deste JSON já estão cadastrados com o status atualizado.')
        setImportRows([])
        return
      }
      for (let offset = 0; offset < pending.length; offset += 400) {
        const batch = writeBatch(db)
        const chunk = pending.slice(offset, offset + 400)
        for (const { id, schedule, updateActive } of chunk) {
          const reference = doc(db, 'schedules', id)
          if (updateActive) {
            batch.update(reference, { active: schedule.active, updatedAt: serverTimestamp() })
          } else {
            batch.set(reference, { ...schedule, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
          }
        }
        await batch.commit()
        processed += chunk.length
        setImportProgress(`${processed} de ${pending.length} horários processados`)
      }
      const updated = pending.filter((item) => item.updateActive).length
      setNotice(`${pending.length - updated} horários cadastrados e ${updated} status atualizados. A localização pode ser preenchida depois.`)
      setImportRows([])
      setImportProgress('')
    } catch {
      setImportError(`A importação parou após ${processed} horários. Confira a conexão e as permissões antes de tentar novamente.`)
    } finally {
      if (processed > 0) await invalidateCatalog('schedules')
      setBusy(false)
    }
  }

  return <section className="schedules-admin-panel" aria-label="Gerenciar horários de Professores">
    {notice && <p className="notice" role="status"><Check size={17} />{notice}</p>}
    {loadError && <p className="form-error" role="alert">{loadError}</p>}
    {formOpen ? (            <form className="schedule-form" aria-labelledby="schedule-form-title" onSubmit={saveSchedule}>
              <div className="form-title"><div><p className="eyebrow dark">HORÁRIO</p><h3 id="schedule-form-title">{editing ? 'Editar aula' : 'Adicionar aula'}</h3></div><button type="button" className="icon-button" disabled={busy} aria-label="Fechar edição de horário" onClick={() => setFormOpen(false)}><X /></button></div>
              <fieldset className="form-grid" disabled={busy}>
                <label>Professor<input autoFocus required maxLength={150} value={form.professor} onChange={(event) => setForm({ ...form, professor: event.target.value })} /></label>
                <label>Matéria<input required maxLength={150} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
                <label>Turma<select required value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })}><option value="">Selecione a turma</option>{availableClasses.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
                <label>Andar<input maxLength={80} value={form.floor} onChange={(event) => setForm({ ...form, floor: event.target.value })} placeholder="Ex.: 1º andar" /></label>
                <label>Dia da semana<select value={form.dayOfWeek} onChange={(event) => setForm({ ...form, dayOfWeek: Number(event.target.value) })}>{WEEKDAYS.map((weekday) => <option value={weekday.value} key={weekday.value}>{weekday.label}</option>)}</select></label>
                <div className="time-fields"><label>Início<input required type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label>Fim<input required type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div>
                <label className="wide">Descrição de onde fica a sala<textarea maxLength={500} rows={3} value={form.roomDescription} onChange={(event) => setForm({ ...form, roomDescription: event.target.value })} placeholder="Ex.: Sala 12, corredor à direita da biblioteca." /></label>
                <label className="toggle wide"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span /> Horário visível no site</label>
              </fieldset>
              {saveError && <p className="form-error">{saveError}</p>}
              <div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button compact" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : 'Salvar horário'}</button></div>
            </form>
) : <>
      <div className="schedule-admin-toolbar"><p>Gerencie a grade de todas as turmas, com professores, matérias, dias, horários e localização.</p><button type="button" className="primary-button compact" disabled={loading || Boolean(loadError) || busy} onClick={startCreate}><Plus size={17} />Novo horário</button></div>
      {loading ? <p role="status"><LoaderCircle size={17} />Carregando horários…</p> : loadError ? null : <><div hidden={adminSection !== 'import'}>
            <section className="import-panel" aria-label="Importar horários por JSON">
              <div className="import-copy"><strong>Importar horários por JSON</strong><span>Os horários ativos ficam visíveis mesmo sem localização. Reimportar atualiza o status dos horários já cadastrados.</span></div>
              <label className="import-file">Escolher JSON<input type="file" accept=".json,application/json" onChange={readImportFile} disabled={busy} /></label>
              {importRows.length > 0 && <div className="import-preview"><span>{importRows.length} horários validados · {new Set(importRows.map((row) => row.className)).size} turmas</span><button className="primary-button compact" onClick={importSchedules} disabled={busy}><Upload size={16} /> {busy ? 'Importando…' : 'Cadastrar horários'}</button></div>}
              {importProgress && <p className="import-progress" role="status">{importProgress}</p>}
              {importError && <p className="form-error" role="alert">{importError}</p>}
            </section>
            </div>
            {adminSection === 'schedules' && <section aria-labelledby="professor-admin-schedules">
            <div className="admin-list-heading">
              <div><h3 id="professor-admin-schedules">Horários cadastrados</h3><span role="status">{filteredAdminSchedules.length.toLocaleString('pt-BR')} {filteredAdminSchedules.length === 1 ? 'horário encontrado' : 'horários encontrados'}</span></div>
              <input type="search" aria-label="Buscar horários cadastrados" placeholder="Buscar professor, matéria ou turma" value={adminSearch} onChange={(event) => { setAdminSearch(event.target.value); setAdminPage(1) }} />
            </div>
            <div className="admin-list">
              {pageSchedules.length === 0 ? <p className="admin-empty">Nenhum horário encontrado.</p> : pageSchedules.map((schedule) => (
                <article key={schedule.id} className="admin-row">
                  <div className="avatar"><UserRound /></div>
                  <div className="admin-row-main"><strong>{schedule.professor}</strong><span>{schedule.subject} · {schedule.className}</span></div>
                  <div className="admin-row-meta"><span>{WEEKDAYS.find((item) => item.value === schedule.dayOfWeek)?.label}</span><strong>{schedule.startTime}–{schedule.endTime}</strong></div>
                  <div className="row-actions">
                    <button disabled={busy} onClick={() => startEdit(schedule)} aria-label={`Editar horário de ${schedule.professor}`}><Edit3 /></button>
                    <button className="danger" disabled={busy} onClick={() => removeSchedule(schedule)} aria-label={`Excluir horário de ${schedule.professor}`}><Trash2 /></button>
                  </div>
                </article>
              ))}
            </div>
            {totalPages > 1 && <nav className="professor-admin-pagination" aria-label="Páginas de horários">
              <button type="button" className="secondary-button" disabled={page === 1} onClick={() => setAdminPage(page - 1)}><ChevronLeft size={16} /> Anterior</button>
              <span aria-live="polite">Página {page} de {totalPages}</span>
              <button type="button" className="secondary-button" disabled={page === totalPages} onClick={() => setAdminPage(page + 1)}>Próxima <ChevronRight size={16} /></button>
            </nav>}
            </section>}</>
}
    </>}
  </section>
}
