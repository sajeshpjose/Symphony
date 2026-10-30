import Anthropic from '@anthropic-ai/sdk';
import { costUsd, type Usage } from '../../../packages/core/src/models';
import { adminClient } from './supabase';
import { HttpError } from './http';

// Reads the workspace's Claude key from Supabase Vault (server only).
export async function claudeFor(workspaceId: string): Promise<Anthropic> {
  const { data, error } = await adminClient().rpc('get_anthropic_key', { ws: workspaceId });
  if (error) throw error;
  if (!data) throw new HttpError(400, 'Add your Claude API key in Settings first');
  return new Anthropic({ apiKey: data as string });
}

// Blocks new work once the monthly cap is reached (if the workspace asks for that).
export async function assertUnderCap(workspaceId: string) {
  const db = adminClient();
  const [{ data: ws }, { data: usage }] = await Promise.all([
    db.from('workspaces').select('monthly_cap_usd, stop_at_cap').eq('id', workspaceId).single(),
    db.from('usage_this_month').select('cost_usd').eq('workspace_id', workspaceId),
  ]);
  const spent = (usage ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  if (ws?.stop_at_cap && spent >= Number(ws.monthly_cap_usd)) {
    throw new HttpError(402, `Monthly cap of $${ws.monthly_cap_usd} reached. Raise it in Settings to continue.`);
  }
}

// One row per Claude call, so Settings can show spend by task.
export async function logUsage(args: {
  workspaceId: string;
  clientId?: string | null;
  purpose: string;
  model: string;
  usage: Usage;
  batch?: boolean;
}) {
  const u = args.usage;
  await adminClient().from('api_usage').insert({
    workspace_id: args.workspaceId,
    client_id: args.clientId ?? null,
    purpose: args.purpose,
    model: args.model,
    input_tokens: u.input_tokens,
    cached_tokens: (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    output_tokens: u.output_tokens,
    batch: !!args.batch,
    cost_usd: costUsd(args.model, u, { batch: args.batch }),
  });
}
