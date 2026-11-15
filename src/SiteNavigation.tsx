import { Bell, CalendarDays, ClipboardList, Columns3, KeyRound, MapPin, UserRound } from 'lucide-react'
import { agendaMenuUrl } from './menuShortcuts'
import { sitePaths } from './sitePaths'
import { SiteOptions } from './SiteOptions'
import { SiteOptionsButton } from './SiteOptionsButton'
import type { AdminRole } from './types'

export function SiteNavigation({ active, role, menu, notifications, onOpenProfile }: {
  active: 'agenda' | 'professores' | 'pegaki' | 'admin' | 'kanban'
  role?: AdminRole
  menu?: { open: boolean; onOpen: () => void; hasPending?: boolean }
  notifications?: { onOpen: () => void; count: number }
  onOpenProfile?: () => void
}) {
  const panelLabel = role === 'superadmin' ? 'Administração' : role === 'representante' ? 'Representante' : null
  return (
    <header className="site-header">
      <nav className="site-navigation" aria-label="Navegação principal">
        <a className="site-brand" href={sitePaths.agenda} aria-label="Tech 2D, início">Tech 2D</a>
        <div className="site-navigation-pages">
          <a href={sitePaths.agenda} aria-current={active === 'agenda' ? 'page' : undefined}><CalendarDays size={17} aria-hidden="true" />Agenda</a>
          <a href={sitePaths.professores} aria-current={active === 'professores' ? 'page' : undefined}><MapPin size={17} aria-hidden="true" />Professores</a>
          <a href={sitePaths.pegaki} aria-current={active === 'pegaki' ? 'page' : undefined}><ClipboardList size={17} aria-hidden="true" />Notas</a>
          <a href={sitePaths.kanban} aria-current={active === 'kanban' ? 'page' : undefined}><Columns3 size={17} aria-hidden="true" />Kanban</a>
          {(panelLabel || active === 'admin') && <a href={sitePaths.admin} aria-current={active === 'admin' ? 'page' : undefined}><KeyRound size={17} aria-hidden="true" />{panelLabel ?? 'Painel'}</a>}
        </div>
        <div className="site-navigation-actions">
          {notifications ? <button type="button" className="site-options-button" onClick={notifications.onOpen}
            aria-label={notifications.count > 0 ? `Notificações da turma, ${notifications.count} não lidas` : 'Notificações da turma'} title="Notificações" aria-haspopup="dialog">
            <Bell size={21} aria-hidden="true" />
            {notifications.count > 0 && <span className="site-options-pending" aria-hidden="true" />}
          </button> : <a className="site-options-button" href={agendaMenuUrl('notifications')} aria-label="Notificações da turma" title="Notificações"><Bell size={21} aria-hidden="true" /></a>}
          {onOpenProfile ? <button type="button" className="site-options-button" onClick={onOpenProfile} aria-label="Perfis da comunidade" title="Perfil" aria-haspopup="dialog"><UserRound size={21} aria-hidden="true" /></button> :
            <a className="site-options-button" href={agendaMenuUrl('profiles')} aria-label="Perfis da comunidade" title="Perfil"><UserRound size={21} aria-hidden="true" /></a>}
          {menu ? <SiteOptionsButton {...menu} /> : <SiteOptions />}
        </div>
      </nav>
    </header>
  )
}
