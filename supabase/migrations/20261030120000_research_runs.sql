-- Research runs (MVP step 3)
-- Saved page text for quote checks, a "needs input" state for sites we cannot read,
-- and the Trigger.dev run id so a run can be traced in the dashboard.

alter table public.research_runs drop constraint if exists research_runs_status_check;
alter table public.research_runs add constraint research_runs_status_check
  check (status in ('queued','running','needs_input','ready','failed'));

alter table public.research_runs
  add column if not exists trigger_run_id text,
  add column if not exists step text,               -- crawl | claims | competitors | verify | write | done
  add column if not exists questions jsonb,         -- internal meeting questions: [{ id, topic, question, trigger, site_says, priority, claim_ids }]
  add column if not exists warnings jsonb not null default '[]'::jsonb, -- blocks dropped by the checks, pages that failed
  add column if not exists stats jsonb not null default '{}'::jsonb;    -- { pages, competitor_pages, claims, included, questions, dropped, searches }

-- Every page read during a run. Quotes in the claims ledger are checked against this text.
create table public.research_pages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ref text not null,                     -- P01, P02 ... used in prompts
  url text not null,
  title text,
  kind text not null default 'client' check (kind in ('client','competitor','pasted','upload')),
  competitor text,                       -- competitor name for competitor pages
  words int not null default 0,
  text text not null,
  fetched_at timestamptz not null default now(),
  unique (run_id, ref)
);
create index on public.research_pages (run_id);

alter table public.research_pages enable row level security;
create policy "members all research_pages" on public.research_pages for all
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

-- ---------------------------------------------------------------------------
-- Google Places API key (Google ratings in research runs), in Vault like the Claude key
-- ---------------------------------------------------------------------------

alter table public.workspaces
  add column if not exists places_key_hint text,
  add column if not exists places_key_ok boolean,
  add column if not exists places_key_tested_at timestamptz;

alter table public.workspace_secrets add column if not exists places_secret_id uuid;

create or replace function public.set_places_key(ws uuid, api_key text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  sid uuid;
begin
  insert into public.workspace_secrets (workspace_id) values (ws) on conflict (workspace_id) do nothing;
  select places_secret_id into sid from public.workspace_secrets where workspace_id = ws;
  if sid is null then
    sid := vault.create_secret(api_key, 'places_key_' || ws::text, 'Google Places API key for workspace ' || ws::text);
    update public.workspace_secrets set places_secret_id = sid where workspace_id = ws;
  else
    perform vault.update_secret(sid, api_key);
  end if;
  update public.workspaces
     set places_key_hint = right(api_key, 4), places_key_ok = null, places_key_tested_at = null
   where id = ws;
end;
$$;

create or replace function public.get_places_key(ws uuid)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select ds.decrypted_secret
    from public.workspace_secrets w
    join vault.decrypted_secrets ds on ds.id = w.places_secret_id
   where w.workspace_id = ws;
$$;

revoke all on function public.set_places_key(uuid, text) from public, anon, authenticated;
revoke all on function public.get_places_key(uuid) from public, anon, authenticated;
grant execute on function public.set_places_key(uuid, text) to service_role;
grant execute on function public.get_places_key(uuid) to service_role;
