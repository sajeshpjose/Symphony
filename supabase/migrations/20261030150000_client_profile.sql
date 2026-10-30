-- Clients no longer wait in a "setup" state. A client is created with name and website, research
-- can run straight away, and the content profile (business details, voice, rules, facts, examples)
-- is filled in whenever needed. Readiness is worked out from what is saved (web/src/lib/profile.ts).
update public.clients set status = 'active' where status = 'setup';
alter table public.clients alter column status set default 'active';
