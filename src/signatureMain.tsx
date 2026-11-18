import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AccountSiteNavigation } from './AccountSiteNavigation'
import { SignatureEditor } from './SignatureEditor'
import { SiteAssistant } from './SiteAssistant'
import { SiteSession } from './SiteSession'
import { observeStoredAppearance } from './appearance'
import './styles.css'
import './portalInterface.css'
import './interface.css'
import './siteNavigation.css'
import './sitePalette.css'

observeStoredAppearance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteSession destination="o editor de assinaturas">
      <div className="app-shell portal-frame">
        <AccountSiteNavigation />
        <SignatureEditor />
        <SiteAssistant />
      </div>
    </SiteSession>
  </StrictMode>,
)
