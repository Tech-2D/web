import { ArrowRight, Bell, CalendarDays, ClipboardList, Columns3, ContactRound, KeyRound, MapPin, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { collection, doc, getDoc, limit, onSnapshot, query, where } from './dataClient'
import { isFeedbackCompleted } from './feedbackStatus'
import { auth, db } from './firebase'
import { agendaMenuUrl } from './menuShortcuts'
import { siteLogoUrl, sitePaths } from './sitePaths'
import { SiteOptions } from './SiteOptions'
import { SiteOptionsButton } from './SiteOptionsButton'
import type { AdminRole, Feedback } from './types'

function AdminNavigationLink({ active }: { active: boolean }) {
  const [hasPending, setHasPending] = useState(false)

  useEffect(() => {
    const account = auth.currentUser
    if (!account) return
    const pending = new Map<string, boolean>()
    const update = (source: string, value: boolean) => {
      if (auth.currentUser !== account) return
      pending.set(source, value)
      setHasPending([...pending.values()].some(Boolean))
    }
    const subscriptions = ['suggestions', 'representativeRequests', 'agendaClassRequests'].map(source =>
      onSnapshot(query(collection(db, source), where('status', '==', 'pendente'), limit(1)), snapshot => {
        update(source, !snapshot.empty)
      }),
    )
    // Older feedback has no status and is still pending in the administration panel.
    subscriptions.push(onSnapshot(collection(db, 'feedback'), snapshot => {
      update('feedback', snapshot.docs.some(item => !isFeedbackCompleted(item.data() as Feedback)))
    }))
    return () => subscriptions.forEach(unsubscribe => unsubscribe())
  }, [])

  return <a href={sitePaths.admin} aria-current={active ? 'page' : undefined}
    aria-label={hasPending ? 'Administração, há pendências' : undefined}
    className={hasPending ? 'site-navigation-admin-pending' : undefined}>
    <KeyRound size={17} aria-hidden="true" />Administração
  </a>
}

function ProfileCompletionReminder({ uid }: { uid: string }) {
  const [missing, setMissing] = useState('')
  const dismissalKey = `tech-2d:profile-reminder:${uid}`

  useEffect(() => {
    try { if (sessionStorage.getItem(dismissalKey)) return } catch { /* The reminder can still be dismissed on this page. */ }
    let active = true
    void getDoc(doc(db, 'userProfiles', uid)).then(snapshot => {
      if (!active || auth.currentUser?.uid !== uid) return
      const profile = snapshot.data()
      const hasName = typeof profile?.displayName === 'string' && profile.displayName.trim().length >= 2
      const hasClass = typeof profile?.className === 'string' && Boolean(profile.className.trim())
      if (!hasName || !hasClass) setMissing(!hasName && !hasClass ? 'seu nome e sua turma' : hasName ? 'sua turma' : 'seu nome')
    }).catch(() => {})
    return () => { active = false }
  }, [dismissalKey, uid])

  if (!missing) return null
  return <aside className="site-profile-reminder" aria-label="Lembrete de perfil">
    <span className="site-profile-reminder-icon" aria-hidden="true"><ContactRound size={25} /></span>
    <div className="site-profile-reminder-copy">
      <strong>Complete seu perfil</strong>
      <p>Adicione {missing} ao seu perfil.</p>
    </div>
    <a href={`${sitePaths.profile}#profiles-edit-title`}>Completar perfil <ArrowRight size={17} aria-hidden="true" /></a>
    <button type="button" aria-label="Dispensar lembrete de perfil" title="Agora não" onClick={() => {
      setMissing('')
      try { sessionStorage.setItem(dismissalKey, '1') } catch { /* In-memory dismissal is sufficient. */ }
    }}><X size={18} aria-hidden="true" /></button>
  </aside>
}

export function SiteNavigation({ active, role, menu, notifications }: {
  active?: 'agenda' | 'professores' | 'pegaki' | 'admin' | 'kanban' | 'profile'
  role?: AdminRole
  menu?: { open: boolean; onOpen: () => void; hasPending?: boolean }
  notifications?: { onOpen: () => void; count: number }
}) {
  const panelLabel = role === 'representante' ? 'Representante' : null
  const account = auth.currentUser
  return (
    <header className="site-header">
      <nav className="site-navigation" aria-label="Navegação principal">
        <a className="site-brand" href={sitePaths.agenda} aria-label="Tech 2D, início">
          <img src={siteLogoUrl} alt="" width={32} height={32} />Tech 2D
        </a>
        <div className="site-navigation-pages">
          <a href={sitePaths.agenda} aria-current={active === 'agenda' ? 'page' : undefined}><CalendarDays size={17} aria-hidden="true" />Agenda</a>
          <a href={sitePaths.professores} aria-current={active === 'professores' ? 'page' : undefined}><MapPin size={17} aria-hidden="true" />Professores</a>
          <a href={sitePaths.pegaki} aria-current={active === 'pegaki' ? 'page' : undefined}><ClipboardList size={17} aria-hidden="true" />Notas</a>
          <a href={sitePaths.kanban} aria-current={active === 'kanban' ? 'page' : undefined}><Columns3 size={17} aria-hidden="true" />Kanban</a>
          {role === 'superadmin' ? <AdminNavigationLink active={active === 'admin'} /> :
            (panelLabel || active === 'admin') && <a href={sitePaths.admin} aria-current={active === 'admin' ? 'page' : undefined}><KeyRound size={17} aria-hidden="true" />{panelLabel ?? 'Painel'}</a>}
        </div>
        <div className="site-navigation-actions">
          {notifications ? <button type="button" className="site-options-button" onClick={notifications.onOpen}
            aria-label={notifications.count > 0 ? `Notificações da turma, ${notifications.count} não lidas` : 'Notificações da turma'} title="Notificações" aria-haspopup="dialog">
            <Bell size={21} aria-hidden="true" />
            {notifications.count > 0 && <span className="site-options-pending" aria-hidden="true" />}
          </button> : <a className="site-options-button" href={agendaMenuUrl('notifications')} aria-label="Notificações da turma" title="Notificações"><Bell size={21} aria-hidden="true" /></a>}
          <a className="site-options-button" href={sitePaths.profile} aria-label="Perfis da comunidade" aria-current={active === 'profile' ? 'page' : undefined} title="Perfil"><UserRound size={21} aria-hidden="true" /></a>
          {menu ? <SiteOptionsButton {...menu} /> : <SiteOptions />}
        </div>
      </nav>
      {active !== 'profile' && account && !account.isAnonymous && <ProfileCompletionReminder key={account.uid} uid={account.uid} />}
    </header>
  )
}
