import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerAccount } from './registration'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase'

vi.mock('./firebase', () => ({ auth: {} }))
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn() }))
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('account registration', () => {
  it('opens a session only after the server accepts the registration', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }, { status: 201 }))
    vi.stubGlobal('fetch', fetcher)
    await registerAccount(' student@example.test ', 'password')
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: 'student@example.test', password: 'password' })
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'student@example.test', 'password')
  })
  it('keeps policy rejections generic and does not sign in or bypass the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'private policy', code: 'private-code' }, { status: 400 })))
    await expect(registerAccount('student@example.test', 'password')).rejects.toMatchObject({ code: 'auth/registration-failed', message: expect.not.stringContaining('private') })
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled()
  })
  it('preserves useful safe error codes and hides raw server messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 'auth/email-already-in-use', message: 'private policy' }, { status: 409 })))
    await expect(registerAccount('student@example.test', 'password')).rejects.toMatchObject({ code: 'auth/email-already-in-use', message: expect.not.stringContaining('private') })
  })
  it('handles a network failure without attempting sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    await expect(registerAccount('student@example.test', 'password')).rejects.toMatchObject({ code: 'auth/network-request-failed' })
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled()
  })
})
