-- Inputs the blog builder needs for any client.
-- Author is required before content (byline and Article markup).
-- Call to action and services are optional: with them the "Next step" paragraph links to the right page;
-- without them it is written without a link, never with an invented one.
alter table public.clients
  add column if not exists author_name text,
  add column if not exists author_role text,
  add column if not exists cta_text text,
  add column if not exists cta_url text,
  add column if not exists services jsonb not null default '[]'::jsonb;  -- [{ name, url? }]

-- A topic is a question, a short gist of the answer and the service it supports.
alter table public.topics
  add column if not exists gist text,
  add column if not exists service text,
  add column if not exists keyword_primary text;
