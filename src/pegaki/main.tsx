import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { SiteSession } from "../SiteSession";
import { onAuthStateChanged } from "firebase/auth";
import { AccountSiteNavigation } from "../AccountSiteNavigation";
import { SiteAssistant } from "../SiteAssistant";
import "../siteNavigation.css";
import "../sitePalette.css";
import "../portalInterface.css";
import { observeStoredAppearance } from "../appearance";

import { auth } from "../firebase";
import { recordSiteAccess } from "../agendaAccess";

observeStoredAppearance();

onAuthStateChanged(auth, user => { if (user && !user.isAnonymous) void recordSiteAccess("pegaki", user); });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SiteSession destination="a área de Notas">
      <div className="app-shell portal-frame">
        <AccountSiteNavigation active="pegaki" />
        <App />
        <SiteAssistant />
      </div>
    </SiteSession>
  </StrictMode>,
);
