import { FirebaseError } from 'firebase/app'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase'

const ENDPOINT = 'https://tech-2d-consultas.tech-2d-auth-email.workers.dev/api/register'
const MESSAGE = 'Não foi possível criar a conta com os dados informados.'
const CODES = new Set(['auth/too-many-requests', 'auth/email-already-in-use', 'auth/weak-password'])

export async function registerAccount(email: string, password: string) {
  const address = email.trim()
  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address, password }), signal: AbortSignal.timeout(35000), redirect: 'error',
    })
  } catch { throw new FirebaseError('auth/network-request-failed', MESSAGE) }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new FirebaseError(CODES.has(body.code) ? body.code : 'auth/registration-failed', MESSAGE)
  }
  return signInWithEmailAndPassword(auth, address, password)
}
