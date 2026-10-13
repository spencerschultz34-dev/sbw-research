import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { cloudEnabled, supabase, type Session } from './cloud'
import { Wordmark } from './components/Shell'

interface Auth {
  cloudEnabled: boolean
  session: Session | null
  email: string | null
  userId: string | null
  createdAt: string | null
  signOut: () => Promise<void>
  changePassword: (pw: string) => Promise<string | null>
}

const Ctx = createContext<Auth>({ cloudEnabled: false, session: null, email: null, userId: null, createdAt: null, signOut: async () => {}, changePassword: async () => null })
export const useAuth = () => useContext(Ctx)

/** Shows the sign-in screen when accounts are switched on; otherwise renders the app as a local demo. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!cloudEnabled)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const value: Auth = {
    cloudEnabled,
    session,
    email: session?.user.email ?? null,
    userId: session?.user.id ?? null,
    createdAt: session?.user.created_at ?? null,
    signOut: async () => { await supabase?.auth.signOut() },
    changePassword: async (pw) => {
      if (!supabase) return 'Accounts are not switched on.'
      const { error } = await supabase.auth.updateUser({ password: pw })
      return error ? error.message : null
    },
  }

  if (!ready) return <div className="auth-page"><Wordmark /></div>
  if (cloudEnabled && !session) return <SignIn />
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up' | 'link'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const redirect = window.location.origin + window.location.pathname

  const friendly = (m: string) => (/fetch|network/i.test(m) ? 'Could not reach the sign-in service. Check your connection and try again.' : m)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setMsg(null)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
        if (error) setMsg({ ok: false, text: friendly(error.message) })
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: redirect } })
        if (error) setMsg({ ok: false, text: friendly(error.message) })
        else if (!data.session) setMsg({ ok: true, text: `Check ${email} for a link to confirm your account.` })
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: false } })
        setMsg(error ? { ok: false, text: friendly(error.message) } : { ok: true, text: `We sent a sign-in link to ${email}.` })
      }
    } finally { setBusy(false) }
  }

  const title = mode === 'up' ? 'Create your account' : mode === 'link' ? 'Get a sign-in link' : 'Sign in'
  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Wordmark />
        <h1>{title}</h1>
        <label className="field-label" htmlFor="auth-email">Work email</label>
        <input id="auth-email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sbw-invest.com" />
        {mode !== 'link' && <>
          <label className="field-label" htmlFor="auth-pw">Password</label>
          <input id="auth-pw" className="input" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
        </>}
        {msg && <p className={`auth-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
        <button className="btn btn-light auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'up' ? 'Create account' : mode === 'link' ? 'Email me a link' : 'Sign in'}</button>
        <div className="auth-links">
          {mode === 'in' && <>
            <button type="button" className="text-btn" onClick={() => { setMode('link'); setMsg(null) }}>Forgot password?</button>
            <button type="button" className="text-btn" onClick={() => { setMode('up'); setMsg(null) }}>Create an account</button>
          </>}
          {mode !== 'in' && <button type="button" className="text-btn" onClick={() => { setMode('in'); setMsg(null) }}>Back to sign in</button>}
        </div>
      </form>
    </div>
  )
}
