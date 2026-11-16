-- =====================================================================================================================
-- Ankiro free-reading leads. Run ONCE in the Supabase SQL Editor.
-- If the editor asks about RLS, click "Run without RLS": this file switches RLS on itself, in the right order.
--
-- What it creates: one table, public.insight_leads: the people who asked for the free AI reading on /free-insight.
-- It keeps their name, email, their Moolank and Bhagyank, the language they chose and how many free questions they
-- used. The date of birth is NOT stored. The IP address is kept only as a salted hash, to limit readings per day.
-- Only the website's server (with the secret key) can read or write it; visitors and customers have no access.
-- To see your leads: Table Editor -> insight_leads (newest first by created_at).
-- =====================================================================================================================

do $guard$
begin
  if to_regclass('public.insight_leads') is not null then
    raise exception 'MIGRATION STOPPED: public.insight_leads already exists. Nothing was changed.';
  end if;
end
$guard$;

create table public.insight_leads (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  name             text not null check (char_length(name) between 2 and 60),
  email            text not null check (char_length(email) between 3 and 254),
  moolank          smallint not null check (moolank between 1 and 9),
  bhagyank         smallint not null check (bhagyank between 1 and 9),
  language         text not null default 'en' check (language in ('en', 'hinglish')),
  ip_hash          text not null check (char_length(ip_hash) = 64),
  preset_used      smallint not null default 0 check (preset_used between 0 and 2),
  typed_used       smallint not null default 0 check (typed_used between 0 and 1),
  consent_version  text not null
);

create index insight_leads_ip_recent on public.insight_leads (ip_hash, created_at desc);
create index insight_leads_email on public.insight_leads (lower(email));

alter table public.insight_leads enable row level security;
revoke all on table public.insight_leads from anon, authenticated;
-- the website's server (secret key = service_role) needs these explicitly: Supabase no longer grants them on new tables
grant select, insert, update on table public.insight_leads to service_role;
