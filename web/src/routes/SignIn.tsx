import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Button, Field, Input, Note } from '../components/ui'
import { useAuth } from '../lib/auth'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { Mark } from '../report/Mark'

export function SignIn() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  if (session) return <Navigate to="/clients" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    // Existing accounts only. New people are added in Supabase → Authentication → Users → Invite.
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin, shouldCreateUser: false } })
    if (error) {
      setError(/sign.?ups? not allowed|not found|otp_disabled/i.test(error.message) ? 'This email does not have access. Ask the workspace owner for an invite.' : error.message)
      setState('error')
    } else setState('sent')
  }

  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-sm">
        <Mark size={44} color="currentColor" className="text-ink" />
        <p className="mt-5 text-fg-2">Research, topics and posts for every client.</p>
        {!supabaseConfigured && (
          <div className="mt-6">
            <Note tone="warn" title="Supabase is not connected">
              {import.meta.env.DEV
                ? 'Copy .env.example to .env and add your Supabase URL and anon key, then restart the dev server.'
                : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify (Site configuration → Environment variables), then redeploy.'}
            </Note>
          </div>
        )}
        {state === 'sent' ? (
          <div className="mt-8">
            <Note tone="ok" title="Check your email">
              We sent a sign-in link to {email}. Open it on this device.
            </Note>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <Field label="Email" error={state === 'error' ? error : undefined}>
              <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@dotyello.com" />
            </Field>
            <Button variant="primary" type="submit" loading={state === 'sending'} disabled={!supabaseConfigured}>
              Email me a sign-in link
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
