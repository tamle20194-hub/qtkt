-- Schema snapshot for Supabase project tzcaxoleefuezhocphyh.
-- Apply through a privileged migration connection, never from the browser.

create table public.technical_procedures (
  code text primary key,
  name text not null,
  specialty text not null,
  approved boolean not null default false,
  approval_year smallint,
  mtd_code text not null default '',
  price_code text not null default '',
  source_code text not null default '',
  source_name text not null default '',
  has_process boolean not null default false,
  indication text not null default '',
  contraindication text not null default '',
  performer text not null default '',
  equipment text not null default '',
  duration text not null default '',
  updated_at timestamptz not null default now(),
  constraint technical_procedures_approval_year_check
    check (approval_year is null or approval_year between 1900 and 2100)
);

create table public.byt_documents (
  code text primary key,
  source_code text not null default '',
  name text not null,
  author text not null default '',
  indication text not null default '',
  contraindication text not null default '',
  performer text not null default '',
  equipment text not null default '',
  duration text not null default '',
  general_content text not null default '',
  procedure_content text not null default '',
  monitoring text not null default '',
  complications text not null default '',
  updated_at timestamptz not null default now()
);

create table public.bv115_documents (
  code text primary key,
  source_code text not null default '',
  name text not null,
  indication text not null default '',
  contraindication text not null default '',
  performer text not null default '',
  equipment text not null default '',
  duration text not null default '',
  updated_at timestamptz not null default now()
);

create index technical_procedures_approved_code_idx
  on public.technical_procedures (approved, code);
create index technical_procedures_specialty_code_idx
  on public.technical_procedures (specialty, code);
create index technical_procedures_source_code_idx
  on public.technical_procedures (source_code);
create index byt_documents_source_code_idx on public.byt_documents (source_code);
create index bv115_documents_source_code_idx on public.bv115_documents (source_code);

alter table public.technical_procedures enable row level security;
alter table public.byt_documents enable row level security;
alter table public.bv115_documents enable row level security;

create policy technical_procedures_public_read
  on public.technical_procedures for select to anon, authenticated using (true);
create policy byt_documents_public_read
  on public.byt_documents for select to anon, authenticated using (true);
create policy bv115_documents_public_read
  on public.bv115_documents for select to anon, authenticated using (true);

revoke all on table public.technical_procedures from anon, authenticated;
revoke all on table public.byt_documents from anon, authenticated;
revoke all on table public.bv115_documents from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on table public.technical_procedures to anon, authenticated;
grant select on table public.byt_documents to anon, authenticated;
grant select on table public.bv115_documents to anon, authenticated;

-- Some projects include this event-trigger helper in public. It does not need
-- to be callable through the Data API; the event trigger continues to run as
-- its owner after EXECUTE is revoked from public roles.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role';
  end if;
end
$$;
