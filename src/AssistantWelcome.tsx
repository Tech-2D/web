import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { ArrowUpRight, CalendarDays, Columns3, MapPin, MessageCircle } from 'lucide-react'
import { buildWelcome, type WelcomeActivity, type WelcomeTopic } from './assistantWelcomeContext'
import d2Avatar from './assets/d2/d2.webp'
import { doc, getDoc } from './dataClient'
import { auth, db } from './firebase'
import type { KanbanBoard } from './kanban'

const topicIcons = { agenda: CalendarDays, kanban: Columns3, professores: MapPin, d2: MessageCircle } satisfies Record<WelcomeTopic, typeof CalendarDays>

export function AssistantWelcome({ account, turma, activities, busy, onAsk }: {
  account: User
  turma: string | null
  activities: readonly WelcomeActivity[]
  busy: boolean
  onAsk: (question: string) => void
}) {
  const [profileName, setProfileName] = useState<string>()
  const [boards, setBoards] = useState<KanbanBoard[]>([])
  const [now, setNow] = useState(() => new Date())
  const welcomeRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef<HTMLDivElement>(null)
  const lastScroll = useRef(-Infinity)

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
      const notes = notesRef.current
      if (!notes || notes.matches(':hover') || performance.now() - lastScroll.current < 4000
        || document.documentElement.dataset.motion === 'reduzido'
        || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      setNow(new Date())
      moveWelcomeNote(notes, 1)
    }, 12000)
    return () => window.clearInterval(interval)
  }, [])

  const welcome = buildWelcome(profileName ?? account.displayName, turma, activities, boards, now)

  return <div ref={welcomeRef} className="assistant-welcome">
    <div className="assistant-welcome-card">
      <div className="assistant-welcome-intro">
        <div>
          <strong>{welcome.greeting}</strong>
          <p>Quer conferir a Agenda ou organizar os estudos comigo?</p>
        </div>
        <img src={d2Avatar} alt="" width="52" height="52" />
      </div>
      <div ref={notesRef} className="assistant-welcome-notes" role="group" aria-label="Dicas do D2" aria-live="off"
        onScroll={() => { lastScroll.current = performance.now() }}
        tabIndex={welcome.notes.length > 1 ? 0 : undefined} onKeyDown={event => {
          if (welcome.notes.length < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
          event.preventDefault()
          moveWelcomeNote(event.currentTarget, event.key === 'ArrowRight' ? 1 : -1)
        }}>
        {welcome.notes.map(note => {
          const NoteIcon = topicIcons[note.topic]
          return <div className="assistant-welcome-note" key={note.label}>
            <NoteIcon size={18} aria-hidden="true" />
            <div className="assistant-welcome-note-copy">
              <span>{note.label}</span>
              <p>{note.text}</p>
            </div>
          </div>
        })}
      </div>
    </div>
    <div className="assistant-examples" role="group" aria-label="Sugestões para conversar com o D2">
      <p>Se quiser, comece por aqui</p>
      {welcome.questions.map(({ text, topic }) => {
        const TopicIcon = topicIcons[topic]
        return <button type="button" key={text} disabled={busy} onClick={() => onAsk(text)}>
          <TopicIcon size={17} aria-hidden="true" />
          <span>{text}</span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      })}
    </div>
  </div>
}

function moveWelcomeNote(notes: HTMLDivElement, direction: 1 | -1) {
  const { clientWidth, scrollLeft, childElementCount } = notes
  if (childElementCount < 2 || !clientWidth) return
  const current = Math.round(scrollLeft / clientWidth)
  const next = (current + direction + childElementCount) % childElementCount
  notes.scrollTo({ left: next * clientWidth })
}
