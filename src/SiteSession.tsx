import { registerAccount } from './registration'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, type User } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { ArrowRight, CalendarDays, ClipboardList, Columns3, Eye, EyeOff, MapPin, RefreshCw, ShieldAlert, ShieldOff } from 'lucide-react'
import { auth } from './firebase'
import { requestPasswordReset } from './passwordReset'
import { API_BASE } from './apiBase'
import { signOut } from './sessionActions'
import { resetQueuedSession } from './queuedWrites'
import { siteLogoUrl } from './sitePaths'
import type { AgendaSession } from './agendaSession'
import type { ClassStatus } from './classLink'
import d2Avatar from './assets/d2/d2.webp'
import './siteSession.css'

type Mode = 'login' | 'register' | 'reset'

function accountError(error: unknown, mode: Mode) {
  const code = error instanceof FirebaseError ? error.code : ''
  if (code === 'auth/network-request-failed') return 'Confira sua conexão e tente novamente.'
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (code === 'auth/registration-failed') return 'Não foi possível criar a conta com os dados informados.'
  if (code === 'auth/email-already-in-use') return 'Este e-mail já tem uma conta. Entre com a sua senha ou solicite a recuperação.'
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') return 'Escolha uma senha mais forte para criar sua conta.'
  if (code === 'auth/user-disabled') return 'Esta conta está desativada. Fale com a administração.'
  if (mode === 'login' && ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) return 'Confira seu e-mail e sua senha.'
  return mode === 'reset' ? 'O link não pôde ser enviado agora. Tente novamente.' : 'Não foi possível continuar. Tente novamente.'
}

type AgendaContent = (user: User, agenda: AgendaSession, updateClass: (status: ClassStatus) => void) => ReactNode

export function SiteSession({ destination, children }: { destination: string; children: ReactNode | AgendaContent }) {
  const [session, setSession] = useState<User | null | undefined>()
  useEffect(() => {
    let previousUid: string | null | undefined
    function update(user: User | null) {
      const account = user && !user.isAnonymous ? user : null
      const uid = account?.uid ?? null
      if (previousUid !== undefined && uid !== previousUid) resetQueuedSession()
      previousUid = uid
      setSession(account)
    }
    return onAuthStateChanged(auth, update, () => update(null))
  }, [])
  useEffect(() => {
    const suspend = (event: PageTransitionEvent) => {
      if (event.persisted) document.documentElement.dataset.siteRestorePending = ''
    }
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload()
    }
    window.addEventListener('pagehide', suspend)
    window.addEventListener('pageshow', restore)
    return () => {
      window.removeEventListener('pagehide', suspend)
      window.removeEventListener('pageshow', restore)
      delete document.documentElement.dataset.siteRestorePending
    }
  }, [])
  return session === undefined ? <SessionLoading /> : session
    ? <PortalAccess key={session.uid} user={session}>{children}</PortalAccess>
    : <AccountEntry destination={destination} />
}

function PortalAccess({ user, children }: { user: User; children: ReactNode | AgendaContent }) {
  const [status, setStatus] = useState<'checking' | 'allowed' | 'blocked' | 'unavailable'>('checking')
  const [attempt, retry] = useState(0)
  const [agenda, setAgenda] = useState<AgendaSession>()
  const classRevision = useRef(0)
  const needsAgenda = typeof children === 'function'
  useEffect(() => {
    const controller = new AbortController()
    let checking = false
    async function checkAccess() {
      if (checking || document.hidden) return
      checking = true
      const revision = classRevision.current
      try {
        const token = await user.getIdToken()
        if (controller.signal.aborted || auth.currentUser?.uid !== user.uid) return
        const response = await fetch(API_BASE + '/api/session/access' + (needsAgenda ? '?agenda=1' : ''), {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        })
        const blocked = response.status === 403 && (await response.json().catch(() => null))?.code === 'agenda-access-blocked'
        const allowed = response.status === (needsAgenda ? 200 : 204)
        if (needsAgenda && allowed) {
          const next: AgendaSession = await response.json()
          if (!Array.isArray(next?.classLink?.classes) || !Object.hasOwn(next, 'profile') || !Object.hasOwn(next, 'screen')) {
            throw new Error('INVALID_AGENDA_SESSION')
          }
          if (!controller.signal.aborted) setAgenda(current => current && revision !== classRevision.current
            ? { ...next, classLink: { ...next.classLink, ...current.classLink, classes: next.classLink.classes } } : next)
        }
        if (!controller.signal.aborted) setStatus(blocked ? 'blocked' : allowed ? 'allowed' : 'unavailable')
      } catch {
        if (!controller.signal.aborted) setStatus('unavailable')
      } finally {
        checking = false
      }
    }
    void checkAccess()
    const timer = window.setInterval(checkAccess, 30000)
    document.addEventListener('visibilitychange', checkAccess)
    window.addEventListener('focus', checkAccess)
    window.addEventListener('online', checkAccess)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', checkAccess)
      window.removeEventListener('focus', checkAccess)
      window.removeEventListener('online', checkAccess)
    }
  }, [user, attempt, needsAgenda])

  function updateClass(link: ClassStatus) {
    classRevision.current += 1
    setAgenda(current => current && { ...current, classLink: { ...current.classLink, ...link } })
  }

  if (status === 'allowed') {
    if (typeof children !== 'function') return <>{children}</>
    return agenda ? <>{children(user, agenda, updateClass)}</> : <SessionLoading />
  }
  if (status === 'checking') return <SessionLoading />
  const blocked = status === 'blocked'
  return <main className="site-entry-check">
    <section className="site-entry-check-card site-access-state" aria-labelledby="site-access-state-title" aria-live="polite">
      <span className="site-access-state-icon" aria-hidden="true">{blocked ? <ShieldOff size={26} /> : <ShieldAlert size={26} />}</span>
      <h1 id="site-access-state-title">{blocked ? 'Acesso ao portal bloqueado' : 'Não foi possível verificar seu acesso'}</h1>
      <p>{blocked ? 'Fale com a administração do portal para obter ajuda.' : 'Confira sua conexão e tente verificar novamente.'}</p>
      <div className="site-access-state-actions">
        <button type="button" className="site-entry-submit" onClick={() => { setStatus('checking'); retry(n => n + 1) }}>
          <RefreshCw size={17} aria-hidden="true" /> Verificar novamente
        </button>
        <button type="button" className="site-entry-link" onClick={() => void signOut(auth)}>Sair da conta</button>
      </div>
    </section>
  </main>
}

export function SessionLoading({ message = 'Verificando sua sessão…' }: { message?: string }) {
  return (
    <main className="site-entry-check">
      <div className="site-entry-check-card site-session-loading" role="status">
        <div className="site-session-mascot" aria-hidden="true">
          <img src={d2Avatar} alt="" width="72" height="72" />
        </div>
        <span className="site-entry-check-brand" aria-hidden="true">Tech 2D</span>
        <p>{message}</p>
        <span className="site-session-progress" aria-hidden="true" />
      </div>
    </main>
  )
}

function AccountEntry({ destination }: { destination: string }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function selectMode(next: Mode) {
    setMode(next)
    setPassword('')
    setVisible(false)
    setError('')
    setMessage('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const address = email.trim()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'register') await registerAccount(address, password)
      else if (mode === 'login') await signInWithEmailAndPassword(auth, address, password)
      else {
        await requestPasswordReset(address)
        setMessage('Se este e-mail estiver cadastrado, você receberá um link. Confira também a pasta de spam.')
      }
    } catch (error) {
      if (mode === 'reset' && error instanceof FirebaseError && error.code === 'auth/user-not-found') {
        setMessage('Se este e-mail estiver cadastrado, você receberá um link. Confira também a pasta de spam.')
      } else setError(accountError(error, mode))
    } finally {
      setBusy(false)
    }
  }

  const action = mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar link'
  return (
    <main className="site-entry">
      <section className="site-entry-intro" aria-labelledby="site-entry-title">
        <p className="site-entry-brand"><img src={siteLogoUrl} alt="" width={40} height={40} />Tech 2D</p>
        <h1 id="site-entry-title">Uma conta para o seu dia na Tech.</h1>
        <p>Entre para abrir {destination}.</p>
        <ul>
          <li><CalendarDays aria-hidden="true" /> Agenda</li>
          <li><MapPin aria-hidden="true" /> Professores</li>
          <li><ClipboardList aria-hidden="true" /> Notas</li>
          <li><Columns3 aria-hidden="true" /> Kanban</li>
        </ul>
      </section>
      <section className="site-entry-card" aria-labelledby="site-entry-form-title">
        <h2 id="site-entry-form-title">{mode === 'reset' ? 'Recuperar senha' : mode === 'register' ? 'Crie sua conta' : 'Entre na sua conta'}</h2>
        <p>{mode === 'reset' ? 'Informe o e-mail usado no cadastro.' : mode === 'register' ? 'Informe seu e-mail e escolha uma senha.' : 'Use o mesmo login em todas as áreas.'}</p>
        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="site-entry-email">E-mail</label>
          <input id="site-entry-email" name="email" type="email" autoComplete="username" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} />
          {mode !== 'reset' && <>
            <label htmlFor="site-entry-password">Senha</label>
            <div className="site-entry-password">
              <input id="site-entry-password" name="password" type={visible ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 6 : undefined} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy}
                aria-describedby={mode === 'register' ? 'site-entry-password-help' : undefined} />
              <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>
                {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
              </button>
            </div>
            {mode === 'register' && <small id="site-entry-password-help">Use pelo menos 6 caracteres.</small>}
          </>}
          {error && <p className="site-entry-error" role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}
          <button className="site-entry-submit" disabled={busy}>{busy ? 'Aguarde…' : action}<ArrowRight size={17} aria-hidden="true" /></button>
          {mode === 'login' && <button type="button" className="site-entry-link" disabled={busy} onClick={() => selectMode('reset')}>Esqueci minha senha</button>}
        </form>
        <div className="site-entry-switch">
          {mode === 'login' ? <>Primeiro acesso? <button type="button" className="site-entry-link" disabled={busy} onClick={() => selectMode('register')}>Criar conta</button></> :
            <button type="button" className="site-entry-link" disabled={busy} onClick={() => selectMode('login')}>Voltar para entrar</button>}
        </div>
      </section>
    </main>
  )
}
