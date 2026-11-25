import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { buildWelcome, type WelcomeActivity } from './assistantWelcomeContext'
import { doc, getDoc } from './dataClient'
import { auth, db } from './firebase'
import type { KanbanBoard } from './kanban'

export function AssistantWelcome({ account, turma, activities, busy, onAsk }: {
  account: User
  turma: string | null
  activities: readonly WelcomeActivity[]
  busy: boolean
  onAsk: (question: string) => void
}) {
  const [profileName, setProfileName] = useState<string>()
  const [boards, setBoards] = useState<KanbanBoard[]>([])
  const [moment, setMoment] = useState(() => ({ now: new Date(), step: 0 }))
  const welcomeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (auth.currentUser?.uid !== account.uid) return
    let active = true
    const isCurrent = () => active && auth.currentUser?.uid === account.uid
    void getDoc(doc(db, 'userProfiles', account.uid)).then(snapshot => {
      const name = snapshot.data()?.displayName
      if (isCurrent() && typeof name === 'string') setProfileName(name)
    }).catch(() => {})
    void getDoc(doc(db, 'personalKanban', account.uid)).then(snapshot => {
      const workspace = snapshot.data()
      if (isCurrent() && workspace?.ownerId === account.uid && Array.isArray(workspace.boards)) setBoards(workspace.boards)
    }).catch(() => {})
    return () => { active = false }
  }, [account.uid])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden || welcomeRef.current?.contains(document.activeElement)) return
      setMoment(current => ({ now: new Date(), step: current.step + 1 }))
    }, 45000)
    return () => window.clearInterval(interval)
  }, [])

  const welcome = buildWelcome(profileName ?? account.displayName, turma, activities, boards, moment.now)

  return <div ref={welcomeRef} className="assistant-welcome">
    <div className="assistant-turn" aria-live="off">
      <strong>{welcome.greeting}</strong>
      <p>{welcome.notes[moment.step % welcome.notes.length]}</p>
    </div>
    <div className="assistant-examples">{welcome.questions.map(question => (
      <button type="button" key={question} disabled={busy} onClick={() => onAsk(question)}>{question}</button>
    ))}</div>
  </div>
}
