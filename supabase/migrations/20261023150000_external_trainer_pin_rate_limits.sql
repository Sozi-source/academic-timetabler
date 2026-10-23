begin;

create table if not exists public.external_trainer_pin_login_attempts (
  key_hash text primary key,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.external_trainer_pin_login_attempts enable row level security;
revoke all on public.external_trainer_pin_login_attempts from public, anon, authenticated;
grant all on public.external_trainer_pin_login_attempts to service_role;

create or replace function public.consume_external_trainer_pin_login_attempt(
  target_key_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempt_count integer;
begin
  insert into public.external_trainer_pin_login_attempts as attempts (
    key_hash,
    attempt_count,
    window_started_at
  )
  values (target_key_hash, 1, now())
  on conflict (key_hash)
  do update set
    attempt_count = case
      when attempts.window_started_at < now() - interval '15 minutes' then 1
      else attempts.attempt_count + 1
    end,
    window_started_at = case
      when attempts.window_started_at < now() - interval '15 minutes' then now()
      else attempts.window_started_at
    end
  returning attempt_count into current_attempt_count;

  return current_attempt_count <= 5;
end;
$$;

revoke all on function public.consume_external_trainer_pin_login_attempt(text)
  from public, anon, authenticated;
grant execute on function public.consume_external_trainer_pin_login_attempt(text)
  to service_role;

commit;
