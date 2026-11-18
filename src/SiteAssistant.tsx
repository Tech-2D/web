import { Suspense, lazy, useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'
import { readPreferredTurma } from './classPreference'

const AssistantChat = lazy(() => import('./AssistantChat'))
const ASSISTANT_ENDPOINT = import.meta.env.VITE_ASSISTANT_API_URL?.trim().replace(/\/+$/, '')

/** Shared assistant launcher for authenticated portal pages outside the Agenda shell. */
export function SiteAssistant() {
  const [account, setAccount] = useState<User | null>(null)

  useEffect(() => onAuthStateChanged(auth, user => {
    setAccount(user && !user.isAnonymous ? user : null)
  }), [])

  if (!ASSISTANT_ENDPOINT || !account) return null

  return <Suspense fallback={null}>
    <AssistantChat key={account.uid} account={account} preferredClass={readPreferredTurma()}
      endpoint={ASSISTANT_ENDPOINT} agendaPath={import.meta.env.BASE_URL} />
  </Suspense>
}
