-- Cover text for social creatives (eyebrow, heading, description), the client's Figma template link,
-- and a token for the Figma plugin. Run after 20261031000000_content_inputs.sql.
alter table public.posts add column if not exists cover jsonb not null default '{}'::jsonb;  -- { eyebrow, heading, description }
alter table public.clients add column if not exists figma_url text;

-- The plugin token is shown once. Only its SHA-256 hash is stored, in the table no browser can read.
alter table public.workspace_secrets add column if not exists plugin_token_hash text;
alter table public.workspaces
  add column if not exists plugin_token_hint text,
  add column if not exists plugin_token_created_at timestamptz;
create unique index if not exists workspace_secrets_plugin_token_hash_idx on public.workspace_secrets (plugin_token_hash) where plugin_token_hash is not null;
notify pgrst, 'reload schema';
