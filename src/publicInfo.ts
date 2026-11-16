import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { apiUrl } from './apiBase'
import { SQL_DATA_CHANGED } from './dataClient'

type Catalog = { notices: Record<string, unknown>[] }

export function observeClassNotices(turma: string, change: (data: Catalog) => void, error: () => void) {
  const url = apiUrl('/api/catalog/notices')
  url.searchParams.set('class', turma)
  let activeRequest: AbortController | undefined
  let timer: ReturnType<typeof setTimeout>

  function refresh() {
    clearTimeout(timer)
    activeRequest?.abort()
    const account = auth.currentUser
    if (!account) {
      change({ notices: [] })
      return
    }
    const controller = new AbortController()
    activeRequest = controller
    void account.getIdToken().then(async token => {
      const response = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
        redirect: 'error',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      })
      if (!response.ok) throw new Error('NOTICES_UNAVAILABLE')
      const data: Catalog = await response.json()
      if (!controller.signal.aborted && auth.currentUser === account) change(data)
    }).catch(() => {
      if (!controller.signal.aborted && auth.currentUser === account) error()
    }).finally(() => {
      if (!controller.signal.aborted && auth.currentUser === account) timer = setTimeout(refresh, 60000)
    })
  }

  const unsubscribe = onAuthStateChanged(auth, () => {
    change({ notices: [] })
    refresh()
  })
  const onChange = (event: Event) => {
    const paths = (event as CustomEvent<{ paths: string[] }>).detail?.paths
    if (paths?.some(path => path.startsWith('boardNotices/'))) refresh()
  }
  window.addEventListener(SQL_DATA_CHANGED, onChange)
  return () => {
    unsubscribe()
    activeRequest?.abort()
    clearTimeout(timer)
    window.removeEventListener(SQL_DATA_CHANGED, onChange)
  }
}
