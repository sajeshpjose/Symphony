-- Symph MVP schema
-- Clients, voice, facts, examples, research runs, topics, posts and API usage.
-- Every row belongs to a workspace; row-level security limits access to workspace members.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Workspaces and membership
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'yello',
  -- Claude API settings. The key itself lives in Supabase Vault (see workspace_secrets); we keep only a hint here.
  anthropic_key_hint text,
  anthropic_key_tested_at timestamptz,
  anthropic_key_ok boolean,
  models jsonb not null default jsonb_build_object(
    'research', 'claude-sonnet-5-5',
    'topics',   'claude-haiku-5-5',
    'post',     'claude-sonnet-5-5',
    'social',   'claude-haiku-5-5',
    'keywords', 'claude-haiku-5-5'
  ),
  use_batch jsonb not null default jsonb_build_object(
    'research', false, 'topics', true, 'post', true, 'social', true, 'keywords', true
  ),
  monthly_cap_usd numeric(10,2) not null default 10,
  alert_thresholds int[] not null default '{70,90}',
  stop_at_cap boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Membership check used by every policy. Security definer so it can read
-- workspace_members without recursive policy evaluation.
create or replace function public.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

-- Every new user gets their own workspace (single-agency tool for now).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid;
begin
  insert into public.workspaces (name) values ('yello') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clients and their voice
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  website text,
  industry text,
  location text,
  sells text,
  audience text,
  goal text,
  success_measure text,
  social_channels text[] not null default '{linkedin,facebook,instagram}',
  status text not null default 'setup' check (status in ('setup','active','paused')),
  setup_step int not null default 1 check (setup_step between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.clients (workspace_id);
create trigger clients_updated before update on public.clients
  for each row execute function public.touch_updated_at();

create table public.voice_profiles (
  client_id uuid primary key references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  formality int not null default 40 check (formality between 0 and 100),
  humor int not null default 30 check (humor between 0 and 100),
  sentence_length int not null default 35 check (sentence_length between 0 and 100),
  traits text[] not null default '{}',
  point_of_view text not null default 'we' check (point_of_view in ('we','i','you','neutral')),
  spelling text not null default 'canadian' check (spelling in ('canadian','us','uk')),
  emoji text not null default 'light' check (emoji in ('none','light','often')),
  hashtags text not null default '1-2' check (hashtags in ('none','1-2','3-5')),
  words_use text[] not null default '{}',
  words_avoid text[] not null default '{}',
  topics_avoid text[] not null default '{}',
  claims_never text[] not null default '{}',
  disclaimer text,
  regulated boolean not null default false,
  task_instructions jsonb not null default '{}'::jsonb,   -- { blog, social, topics }
  channel_overrides jsonb not null default '{}'::jsonb,   -- { linkedin: { note, length, hashtags }, ... }
  summary text,                                          -- "How Claude will read this"
  updated_at timestamptz not null default now()
);
create trigger voice_updated before update on public.voice_profiles
  for each row execute function public.touch_updated_at();

create table public.examples (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('loved','disliked')),
  channel text,
  title text,
  body text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index on public.examples (client_id);

create table public.facts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  text text not null,
  type text not null default 'service'
    check (type in ('service','price','area','credential','number','testimonial','story','faq')),
  source text,
  status text not null default 'approved'
    check (status in ('approved','needs_proof','consent_needed')),
  research_run_id uuid,
  created_at timestamptz not null default now()
);
create index on public.facts (client_id);

-- ---------------------------------------------------------------------------
-- Research
-- ---------------------------------------------------------------------------

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_type text not null default 'first' check (run_type in ('first','v2','quarterly')),
  status text not null default 'queued' check (status in ('queued','running','ready','failed')),
  website text,
  inputs jsonb not null default '{}'::jsonb,     -- uploaded file paths: ga4, meta_ads, reviews, linkedin
  progress text,                                 -- "Reading 31 pages…"
  report jsonb,                                  -- report data (see skills/client-intelligence-report/references/data-schema.md)
  claims jsonb,                                  -- claims ledger: [{ claim, source, status, reason }]
  pdf_path text,
  error text,
  cost_usd numeric(10,4),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.research_runs (client_id, created_at desc);

alter table public.facts
  add constraint facts_research_run_fk foreign key (research_run_id)
  references public.research_runs(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Topics and posts
-- ---------------------------------------------------------------------------

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_run_id uuid references public.research_runs(id) on delete set null,
  title text not null,
  why text,               -- the signal: "Bank of Canada cut on Oct 22"
  who_asks text,
  pillar text,
  demand text check (demand in ('low','medium','high')),
  ai_gap text,            -- "no local answer", "competitor cited"
  image_keywords text[] not null default '{}',
  selected boolean not null default true,
  status text not null default 'suggested'
    check (status in ('suggested','writing','written','dropped')),
  created_at timestamptz not null default now()
);
create index on public.topics (client_id, created_at desc);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'writing'
    check (status in ('writing','to_review','reviewed','failed')),
  title text,
  body_md text,
  body_html text,
  faq jsonb,                                     -- [{ q, a }] for FAQPage markup
  checks jsonb not null default '[]'::jsonb,     -- [{ id, label, status: pass|warn|fail, note }]
  social jsonb not null default '{}'::jsonb,     -- { linkedin: { text, hashtags }, facebook: {...}, instagram: {...} }
  image_keywords jsonb not null default '[]'::jsonb, -- [{ phrase, why }]
  image_avoid text,
  version int not null default 1,
  batch_id text,                                 -- Anthropic message batch id while writing
  error text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.posts (client_id, status);
create trigger posts_updated before update on public.posts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- API usage (one row per Claude call)
-- ---------------------------------------------------------------------------

create table public.api_usage (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  purpose text not null check (purpose in ('test','research','topics','post','social','keywords','regenerate','voice')),
  model text not null,
  input_tokens int not null default 0,
  cached_tokens int not null default 0,
  output_tokens int not null default 0,
  batch boolean not null default false,
  cost_usd numeric(10,5) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.api_usage (workspace_id, created_at desc);

-- Month-to-date spend, used by the cap check and the Settings screen.
create or replace view public.usage_this_month
with (security_invoker = true) as
select
  workspace_id,
  purpose,
  count(*)::int as calls,
  sum(cost_usd)::numeric(10,2) as cost_usd
from public.api_usage
where created_at >= date_trunc('month', now())
group by workspace_id, purpose;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.clients enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.examples enable row level security;
alter table public.facts enable row level security;
alter table public.research_runs enable row level security;
alter table public.topics enable row level security;
alter table public.posts enable row level security;
alter table public.api_usage enable row level security;

create policy "members read workspace" on public.workspaces
  for select using (public.is_member(id));
create policy "members update workspace" on public.workspaces
  for update using (public.is_member(id)) with check (public.is_member(id));

create policy "members read membership" on public.workspace_members
  for select using (user_id = auth.uid() or public.is_member(workspace_id));

-- Same rule for every workspace-owned table.
do $$
declare t text;
begin
  foreach t in array array['clients','voice_profiles','examples','facts','research_runs','topics','posts']
  loop
    execute format('create policy "members all %1$s" on public.%1$I for all
      using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));', t);
  end loop;
end $$;

-- Usage rows are written by server functions only; members can read them.
create policy "members read usage" on public.api_usage
  for select using (public.is_member(workspace_id));

-- Vault secret ids live in their own table with RLS on and no policies,
-- so only the service role (server functions) can read it.
create table public.workspace_secrets (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  anthropic_secret_id uuid
);
alter table public.workspace_secrets enable row level security;

-- ---------------------------------------------------------------------------
-- Claude API key in Supabase Vault (server only)
-- ---------------------------------------------------------------------------

create or replace function public.set_anthropic_key(ws uuid, api_key text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  sid uuid;
begin
  select anthropic_secret_id into sid from public.workspace_secrets where workspace_id = ws;
  if sid is null then
    sid := vault.create_secret(api_key, 'anthropic_key_' || ws::text, 'Claude API key for workspace ' || ws::text);
    insert into public.workspace_secrets (workspace_id, anthropic_secret_id) values (ws, sid)
      on conflict (workspace_id) do update set anthropic_secret_id = excluded.anthropic_secret_id;
  else
    perform vault.update_secret(sid, api_key);
  end if;
  update public.workspaces
     set anthropic_key_hint = right(api_key, 4),
         anthropic_key_ok = null,
         anthropic_key_tested_at = null
   where id = ws;
end;
$$;

create or replace function public.get_anthropic_key(ws uuid)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select ds.decrypted_secret
    from public.workspace_secrets w
    join vault.decrypted_secrets ds on ds.id = w.anthropic_secret_id
   where w.workspace_id = ws;
$$;

revoke all on function public.set_anthropic_key(uuid, text) from public, anon, authenticated;
revoke all on function public.get_anthropic_key(uuid) from public, anon, authenticated;
grant execute on function public.set_anthropic_key(uuid, text) to service_role;
grant execute on function public.get_anthropic_key(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: screens update as research runs and posts change status
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.research_runs, public.topics, public.posts;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for research uploads (GA4 CSV, Meta Ads, PDFs)
-- Paths are "<workspace_id>/<client_id>/<file>".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy "members read uploads" on storage.objects for select
  using (bucket_id = 'uploads' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members write uploads" on storage.objects for insert
  with check (bucket_id = 'uploads' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members delete uploads" on storage.objects for delete
  using (bucket_id = 'uploads' and public.is_member(((storage.foldername(name))[1])::uuid));
