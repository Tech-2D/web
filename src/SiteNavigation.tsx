import { Bell, CalendarDays, ClipboardList, Columns3, KeyRound, MapPin, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, query, where } from './dataClient'
import { isFeedbackCompleted } from './feedbackStatus'
import { auth, db } from './firebase'
import { agendaMenuUrl } from './menuShortcuts'
import { sitePaths } from './sitePaths'
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

export function SiteNavigation({ active, role, menu, notifications }: {
  active?: 'agenda' | 'professores' | 'pegaki' | 'admin' | 'kanban' | 'profile'
  role?: AdminRole
  menu?: { open: boolean; onOpen: () => void; hasPending?: boolean }
  notifications?: { onOpen: () => void; count: number }
}) {
  const panelLabel = role === 'representante' ? 'Representante' : null
  return (
    <header className="site-header">
      <nav className="site-navigation" aria-label="Navegação principal">
        <a className="site-brand" href={sitePaths.agenda} aria-label="Tech 2D, início">Tech 2D</a>
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
    </header>
  )
}
