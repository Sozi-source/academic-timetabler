create table public.department_google_integrations (
  department_id uuid primary key references public.departments(id) on delete cascade,
  google_email text not null,
  refresh_token_ciphertext text not null,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.department_google_integrations is
  'Encrypted Google OAuth refresh tokens used for department-owned assessment mark sheets.';

alter table public.department_google_integrations enable row level security;
revoke all on table public.department_google_integrations from anon, authenticated;
grant all on table public.department_google_integrations to service_role;
