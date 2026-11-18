import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ProfilePage } from './ProfilePage'
import { SiteAssistant } from './SiteAssistant'
import { AccountSiteNavigation } from './AccountSiteNavigation'
import { SiteSession } from './SiteSession'
import { observeStoredAppearance } from './appearance'
import './styles.css'
import './portalInterface.css'
import './interface.css'
import './siteNavigation.css'
import './sitePalette.css'

observeStoredAppearance()
createRoot(document.getElementById('root')!).render(
  <StrictMode><SiteSession destination="seu perfil"><div className="app-shell portal-frame"><AccountSiteNavigation active="profile" /><ProfilePage /><SiteAssistant /></div></SiteSession></StrictMode>,
)
