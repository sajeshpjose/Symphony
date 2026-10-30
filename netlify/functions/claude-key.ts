// POST /api/claude-key
//   { action: "save", apiKey }  -> stores the key in Vault, then tests it
//   { action: "test" }          -> tests the stored key
// The key never goes back to the browser; only its last 4 characters.
import Anthropic from '@anthropic-ai/sdk';
import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { handle, json, HttpError } from './_shared/http';
import { adminClient, requireUser } from './_shared/supabase';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), apiKey: z.string().trim().min(20).startsWith('sk-ant-') }),
  z.object({ action: z.literal('test') }),
]);

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST');
  const { workspaceId } = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, 'That does not look like an Anthropic API key (it starts with sk-ant-)');
  const db = adminClient();

  if (parsed.data.action === 'save') {
    const { error } = await db.rpc('set_anthropic_key', { ws: workspaceId, api_key: parsed.data.apiKey });
    if (error) throw error;
  }

  const { data: key, error: keyErr } = await db.rpc('get_anthropic_key', { ws: workspaceId });
  if (keyErr) throw keyErr;
  if (!key) throw new HttpError(400, 'No key saved yet');

  // Listing models checks the key without spending tokens.
  const started = Date.now();
  let ok = true;
  let message = 'Connected';
  try {
    await new Anthropic({ apiKey: key as string }).models.list({ limit: 1 });
  } catch (e) {
    ok = false;
    const status = (e as { status?: number }).status;
    message = status === 401 ? 'Anthropic rejected this key' : 'Could not reach Anthropic. Try again.';
  }
  const ms = Date.now() - started;
  await db
    .from('workspaces')
    .update({ anthropic_key_ok: ok, anthropic_key_tested_at: new Date().toISOString() })
    .eq('id', workspaceId);

  return json({ ok, message, ms });
});

export const config: Config = { path: '/api/claude-key' };
