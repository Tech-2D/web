import { registerAccount } from './registration'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, type User } from 'firebase/auth'
import { signOut } from './sessionActions'
import { auth } from './firebase'
import { Camera, Check, CheckCircle2, ChevronRight, GraduationCap, LoaderCircle, LogOut, MapPin, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import './profiles.css'

const API = 'https://tech-2d-auth-email.vercel.app'
type Profile = { uid: string; displayName: string; company: string; className: string; room: string; floor: string; photoUrl: string | null }
type Fields = Pick<Profile, 'displayName' | 'company' | 'className' | 'room' | 'floor'>
const empty: Fields = { displayName: '', company: '', className: '', room: '', floor: '' }

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Não foi possível carregar os perfis.')
  return data
}

export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [mine, setMine] = useState<Profile | null>(null)
  const [fields, setFields] = useState<Fields>(empty)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState<'mine' | 'community'>('mine')
  const [loading, setLoading] = useState(true)
  const [directoryLoading, setDirectoryLoading] = useState(true)
  const [directoryError, setDirectoryError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [profileReload, setProfileReload] = useState(0)
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLButtonElement>('[aria-label="Fechar perfil"]')?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? [])].filter(el => el.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard); if (previous instanceof HTMLElement) previous.focus() }
  }, [onClose])

  useEffect(() => onAuthStateChanged(auth, setUser), [])
  useEffect(() => {
    let active = true
    setDirectoryLoading(true)
    setDirectoryError('')
    if (!user) { setDirectoryLoading(false); setProfiles([]) }
    if (user) user.getIdToken().then(token => request('/api/profiles', { headers: { Authorization: 'Bearer ' + token } })).then(data => { if (active) setProfiles(data.profiles || []) }).catch(e => { if (active) setDirectoryError(e.message) }).finally(() => { if (active) setDirectoryLoading(false) })
    return () => { active = false }
  }, [refresh, user])
  useEffect(() => {
    let active = true
    setMine(null)
    setFields(empty)
    setLoading(Boolean(user))
    setLoadError('')
    if (user) user.getIdToken().then(token => request('/api/profiles?scope=mine', { headers: { Authorization: `Bearer ${token}` } })).then(data => {
      if (active && data.profile) { setMine(data.profile); setFields({ displayName: data.profile.displayName, company: data.profile.company, className: data.profile.className, room: data.profile.room, floor: data.profile.floor }) }
    }).catch(e => { if (active) setLoadError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user, profileReload])

  async function authenticate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      if (register) await registerAccount(email.trim(), password)
      else await signInWithEmailAndPassword(auth, email.trim(), password)
      setPassword('')
    } catch { setError('Não foi possível entrar. Confira e-mail e senha ou tente outra conta.') }
    finally { setBusy(false) }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); if (!user) return
    setBusy(true); setError(''); setNotice('')
    try {
      const token = await user.getIdToken()
      const data = await request('/api/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(fields) })
      setMine(data.profile); setNotice('Alterações salvas no seu perfil.'); setRefresh(value => value + 1)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.') }
    finally { setBusy(false) }
  }

  async function changePhoto(file: File | null) {
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Escolha uma foto JPG, PNG ou WebP de até 2 MB.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
      const token = await user.getIdToken()
      const data = await request('/api/profile-photo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'upload', base64: btoa(binary), mimeType: file.type }) })
      setMine(current => current ? { ...current, photoUrl: data.photoUrl } : current)
      setNotice('Foto atualizada.'); setRefresh(value => value + 1)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar a foto.') }
    finally { setBusy(false) }
  }

  async function removePhoto() {
    if (!user) return
    setBusy(true); setError(''); setNotice('')
    try {
      const token = await user.getIdToken()
      await request('/api/profile-photo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'remove' }) })
      setMine(current => current ? { ...current, photoUrl: null } : current)
      setNotice('Foto removida.'); setRefresh(value => value + 1)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível remover a foto.') }
    finally { setBusy(false) }
  }

  const preview = { ...fields, photoUrl: mine?.photoUrl ?? null }
  return <div className="profiles-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="profiles-dialog" role="dialog" aria-modal="true" aria-labelledby="profiles-title">
      <header className="profiles-header"><div><span className="profiles-eyebrow">Tech 2D · Comunidade</span><h2 id="profiles-title">Seu espaço no portal</h2></div><button type="button" className="profiles-icon-button" onClick={onClose} aria-label="Fechar perfil"><X size={21} /></button></header>
      <nav className="profiles-tabs" aria-label="Área de perfis">
        <button type="button" aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}><UserRound size={18} />Meu perfil</button>
        <button type="button" aria-pressed={tab === 'community'} onClick={() => setTab('community')}><Users size={18} />Comunidade</button>
      </nav>
      {error && <p role="alert" className="profiles-error">{error}</p>}
      {notice && <p role="status" className="profiles-notice"><CheckCircle2 size={17} />{notice}</p>}
      {tab === 'mine' ? <div className="profiles-body">
        <aside className="profiles-identity">
          <ProfileAvatar profile={preview} large />
          <h3>{fields.displayName.trim() || 'Seu nome no portal'}</h3>
          <p>{[fields.company, fields.className].filter(Boolean).join(' · ') || 'Complete seu perfil para se apresentar à comunidade.'}</p>
          <span className="profiles-published">{mine ? <><CheckCircle2 size={15} />Perfil publicado</> : 'Ainda não publicado'}</span>
          {user && <>
            <div className="profiles-photo">
              <label className="profiles-file"><Camera size={16} />{mine?.photoUrl ? 'Trocar foto' : 'Adicionar foto'}<input type="file" aria-label="Foto de perfil" accept="image/jpeg,image/png,image/webp" disabled={busy || !mine || loading} onChange={e => { void changePhoto(e.target.files?.[0] || null); e.target.value = '' }} /></label>
              {mine?.photoUrl && <button type="button" className="profiles-link" disabled={busy} onClick={removePhoto}>Remover foto</button>}
              <small>{mine ? 'JPG, PNG ou WebP · até 2 MB' : 'Salve seu perfil antes de adicionar uma foto.'}</small>
            </div>
            <div className="profiles-account"><span>Sua conta</span><strong>{user.email}</strong><button type="button" className="profiles-link" disabled={busy} onClick={() => void signOut(auth).catch(() => setError('Não foi possível sair. Tente novamente.'))}><LogOut size={15} />Sair da conta</button></div>
          </>}
        </aside>
        <section className="profiles-edit" aria-labelledby="profiles-edit-title">
          <div className="profiles-section-heading"><h3 id="profiles-edit-title">Informações do perfil</h3><p>É assim que as pessoas vão encontrar você no portal.</p></div>
          {!user ? <form onSubmit={authenticate} className="profiles-form"><p>Entre na sua conta para editar seu perfil.</p>
            <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
            <label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={register ? 'new-password' : 'current-password'} /></label>
            <button type="submit" className="profiles-primary" disabled={busy}>{register ? 'Criar conta' : 'Entrar'}</button>
            <button type="button" className="profiles-link" onClick={() => setRegister(!register)}>{register ? 'Já tenho conta' : 'Criar uma conta'}</button>
          </form> : loading ? <div className="profiles-loading" role="status"><LoaderCircle size={24} /><span>Carregando seu perfil…</span></div> :
          loadError ? <div className="profiles-empty" role="alert"><p>{loadError}</p><button type="button" className="profiles-link" onClick={() => setProfileReload(n => n + 1)}>Tentar novamente</button></div> : <form onSubmit={save} className="profiles-form">
            <fieldset disabled={busy}><legend>Sobre você</legend>
              <label>Nome<span className="profiles-field-help">Como você quer ser chamado</span><input autoComplete="name" value={fields.displayName} onChange={e => setFields({ ...fields, displayName: e.target.value })} maxLength={80} minLength={2} required placeholder="Seu nome" /></label>
              <div className="profiles-pair"><label>Empresa <span className="profiles-optional">Opcional</span><input autoComplete="organization" value={fields.company} onChange={e => setFields({ ...fields, company: e.target.value })} maxLength={100} placeholder="Empresa ou instituição" /></label>
              <label>Turma <span className="profiles-optional">Opcional</span><input value={fields.className} onChange={e => setFields({ ...fields, className: e.target.value })} maxLength={80} placeholder="Ex.: 2º Tec D" /></label></div>
            </fieldset>
            <fieldset disabled={busy}><legend>Onde encontrar você</legend><p>Preencha se quiser compartilhar sua localização na escola.</p>
              <div className="profiles-pair"><label>Sala <span className="profiles-optional">Opcional</span><input value={fields.room} onChange={e => setFields({ ...fields, room: e.target.value })} maxLength={80} placeholder="Ex.: 12" /></label><label>Andar <span className="profiles-optional">Opcional</span><input value={fields.floor} onChange={e => setFields({ ...fields, floor: e.target.value })} maxLength={30} placeholder="Ex.: 2º andar" /></label></div>
            </fieldset>
            <div className="profiles-privacy"><ShieldCheck size={20} /><p>Nome, foto e informações preenchidas ficam visíveis na comunidade. Seu e-mail fica privado.</p></div>
            <div className="profiles-save"><span>{mine ? 'As alterações aparecem após salvar.' : 'Publique para aparecer na comunidade.'}</span><button type="submit" className="profiles-primary" disabled={busy}>{busy ? <LoaderCircle size={17} /> : <Check size={17} />}{busy ? 'Salvando…' : mine ? 'Salvar alterações' : 'Publicar perfil'}</button></div>
          </form>}
        </section>
      </div> : <CommunityDirectory profiles={profiles} loading={directoryLoading} error={directoryError} currentUid={user?.uid} onRetry={() => setRefresh(n => n + 1)} onEdit={() => setTab('mine')} />}
    </section>
  </div>
}

function ProfileAvatar({ profile, large = false }: { profile: { displayName: string; photoUrl: string | null }; large?: boolean }) {
  const initials = profile.displayName.trim().split(/\s+/).slice(0, 2).map(name => name[0]).join('').toUpperCase()
  return profile.photoUrl ? <img className={`profiles-avatar${large ? ' profiles-avatar-large' : ''}`} src={profile.photoUrl} alt={large ? 'Sua foto de perfil' : ''} /> :
    <span className={`profiles-avatar${large ? ' profiles-avatar-large' : ''}`} aria-hidden="true">{initials || <UserRound size={large ? 36 : 23} />}</span>
}

function CommunityDirectory({ profiles, loading, error, currentUid, onRetry, onEdit }: { profiles: Profile[]; loading: boolean; error: string; currentUid?: string; onRetry: () => void; onEdit: () => void }) {
  const [search, setSearch] = useState('')
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const results = profiles.filter(profile => normalize([profile.displayName, profile.company, profile.className, profile.room, profile.floor].join(' ')).includes(normalize(search.trim())))
  return <section className="profiles-directory" aria-labelledby="profiles-community-title">
    <div className="profiles-directory-heading"><div><h3 id="profiles-community-title">Pessoas da comunidade</h3><p>Conheça quem compartilha o dia a dia na Tech.</p></div><button type="button" className="profiles-link" onClick={onEdit}>Editar meu perfil<ChevronRight size={16} /></button></div>
    <label className="profiles-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar pessoas na comunidade" type="search" placeholder="Buscar por nome, turma ou empresa" value={search} onChange={e => setSearch(e.target.value)} /></label>
    {loading ? <div className="profiles-loading" role="status"><LoaderCircle size={24} />Carregando a comunidade…</div> : error ? <div className="profiles-empty" role="alert"><p>{error}</p><button type="button" className="profiles-link" onClick={onRetry}>Tentar novamente</button></div> : <>
      <p className="profiles-result-count" role="status">{results.length} {results.length === 1 ? 'pessoa' : 'pessoas'}{search ? ' encontradas' : ' na comunidade'}</p>
      {results.length === 0 ? <div className="profiles-empty"><Users size={30} /><h4>{search ? 'Nenhum perfil encontrado' : 'A comunidade começa com você'}</h4><p>{search ? 'Tente outro nome, turma ou empresa.' : 'Publique seu perfil para aparecer aqui.'}</p><button type="button" className="profiles-link" onClick={search ? () => setSearch('') : onEdit}>{search ? 'Limpar busca' : 'Completar meu perfil'}</button></div> :
      <div className="profiles-grid">{results.map(profile => <article key={profile.uid} className="profiles-card">
        <div className="profiles-card-top"><ProfileAvatar profile={profile} /><div><h4>{profile.displayName}</h4>{profile.company && <p>{profile.company}</p>}</div>{profile.uid === currentUid && <span className="profiles-you">Você</span>}</div>
        {(profile.className || profile.room || profile.floor) && <div className="profiles-card-details">{profile.className && <span><GraduationCap size={15} />{profile.className}</span>}{(profile.room || profile.floor) && <span><MapPin size={15} />{[profile.room && `Sala ${profile.room}`, profile.floor].filter(Boolean).join(' · ')}</span>}</div>}
      </article>)}</div>}
    </>}
  </section>
}
