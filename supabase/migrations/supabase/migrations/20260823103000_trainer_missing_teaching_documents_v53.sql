-- Academic Planner - Trainer Missing Teaching Documents V5.3

create table if not exists public.trainer_teaching_document_versions (
    id uuid primary key default gen_random_uuid(),
    allocation_id uuid not null,
    unit_id uuid not null,
    owner_user_id uuid not null,
    document_type text not null
        check (document_type in ('course_outline', 'scheme_of_work')),
    version_number integer not null default 1
        check (version_number >= 1),
    status text not null default 'active'
        check (status in ('active', 'superseded', 'retired')),
    source_file_name text,
    source_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    superseded_at timestamptz,
    retired_at timestamptz
);

create unique index if not exists trainer_teaching_document_versions_one_active
    on public.trainer_teaching_document_versions (allocation_id, document_type)
    where status = 'active';

create index if not exists trainer_teaching_document_versions_owner_idx
    on public.trainer_teaching_document_versions (owner_user_id, document_type, status);

create index if not exists trainer_teaching_document_versions_unit_idx
    on public.trainer_teaching_document_versions (unit_id, document_type, status);

alter table public.trainer_teaching_document_versions enable row level security;

drop policy if exists trainer_teaching_document_versions_select_own
    on public.trainer_teaching_document_versions;
create policy trainer_teaching_document_versions_select_own
    on public.trainer_teaching_document_versions
    for select
    to authenticated
    using (owner_user_id = auth.uid());

drop policy if exists trainer_teaching_document_versions_insert_own
    on public.trainer_teaching_document_versions;
create policy trainer_teaching_document_versions_insert_own
    on public.trainer_teaching_document_versions
    for insert
    to authenticated
    with check (owner_user_id = auth.uid());

drop policy if exists trainer_teaching_document_versions_update_own
    on public.trainer_teaching_document_versions;
create policy trainer_teaching_document_versions_update_own
    on public.trainer_teaching_document_versions
    for update
    to authenticated
    using (owner_user_id = auth.uid())
    with check (owner_user_id = auth.uid());

comment on table public.trainer_teaching_document_versions is
'Versioned trainer Course Outline and Scheme of Work uploads. V5.3 missing-workbook generation checks only active rows.';
