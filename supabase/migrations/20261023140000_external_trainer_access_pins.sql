begin;

create table if not exists public.external_trainer_access_pins (
  trainer_id uuid primary key references public.trainers(id) on delete cascade,
  pin_hash text not null unique,
  issued_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.external_trainer_access_pins enable row level security;

revoke all on public.external_trainer_access_pins from public, anon, authenticated;
grant all on public.external_trainer_access_pins to service_role;

comment on table public.external_trainer_access_pins is
  'Stores only a hash of each active external trainer PIN. PIN access is issued and validated through server-side service-role operations.';

commit;
