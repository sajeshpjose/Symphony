import { supabase } from './supabase'

// Calls a Netlify function with the user's session token.
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(data.session ? { authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json as T
}
