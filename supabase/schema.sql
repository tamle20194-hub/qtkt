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

create table public.procedure_pdf_sources (
  code text primary key,
  target_type text not null,
  target_code text not null,
  title text not null,
  organization text not null,
  decision_number text not null default '',
  decision_date date,
  pdf_url text not null,
  source_page_url text not null default '',
  verified_at timestamptz not null default now(),
  is_primary boolean not null default true,
  constraint procedure_pdf_sources_target_type_check
    check (target_type in ('source_group', 'technical', 'byt', 'bv115')),
  constraint procedure_pdf_sources_pdf_url_check
    check (pdf_url like 'https://%'),
  constraint procedure_pdf_sources_source_page_url_check
    check (source_page_url = '' or source_page_url like 'https://%'),
  constraint procedure_pdf_sources_target_url_key
    unique (target_type, target_code, pdf_url)
);

create index technical_procedures_approved_code_idx
  on public.technical_procedures (approved, code);
create index technical_procedures_specialty_code_idx
  on public.technical_procedures (specialty, code);
create index technical_procedures_source_code_idx
  on public.technical_procedures (source_code);
create index byt_documents_source_code_idx on public.byt_documents (source_code);
create index bv115_documents_source_code_idx on public.bv115_documents (source_code);
create index procedure_pdf_sources_target_idx
  on public.procedure_pdf_sources (target_type, target_code, is_primary, code);

alter table public.technical_procedures enable row level security;
alter table public.byt_documents enable row level security;
alter table public.bv115_documents enable row level security;
alter table public.procedure_pdf_sources enable row level security;

create policy technical_procedures_public_read
  on public.technical_procedures for select to anon, authenticated using (true);
create policy byt_documents_public_read
  on public.byt_documents for select to anon, authenticated using (true);
create policy bv115_documents_public_read
  on public.bv115_documents for select to anon, authenticated using (true);
create policy procedure_pdf_sources_public_read
  on public.procedure_pdf_sources for select to anon, authenticated using (true);

revoke all on table public.technical_procedures from anon, authenticated;
revoke all on table public.byt_documents from anon, authenticated;
revoke all on table public.bv115_documents from anon, authenticated;
revoke all on table public.procedure_pdf_sources from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on table public.technical_procedures to anon, authenticated;
grant select on table public.byt_documents to anon, authenticated;
grant select on table public.bv115_documents to anon, authenticated;
grant select on table public.procedure_pdf_sources to anon, authenticated;

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
