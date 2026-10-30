import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http';

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new HttpError(500, `Server is missing ${k}`);
  return v;
};

// Service-role client: bypasses row-level security, so every function must check membership itself.
let admin: SupabaseClient | null = null;
export const adminClient = () =>
  (admin ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  }));

export type Caller = { userId: string; workspaceId: string };

// Verifies the user's Supabase session from the Authorization header and returns their workspace.
export async function requireUser(req: Request): Promise<Caller> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in first');
  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Sign in again.');
  const { data: m } = await db
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', data.user.id)
    .limit(1)
    .maybeSingle();
  if (!m) throw new HttpError(403, 'No workspace for this account');
  return { userId: data.user.id, workspaceId: m.workspace_id };
}
