begin;

-- ============================================================================
-- Staff Access Provisioning + Authentication Hardening V13
-- ============================================================================

-- New profiles must never inherit HOD privileges by default.
alter table public.profiles
  alter column role
  set default 'pending'::public.app_role;

-- ----------------------------------------------------------------------------
-- Auth-user profile bootstrap
--
-- Public account creation is safe:
-- - an active pre-registered trainer using the same email and requesting the
--   trainer role is linked automatically;
-- - every other new account is created as PENDING and receives no HOD/trainer
--   authorization.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  matched_trainer_id uuid;
  matched_trainer_name text;
  profile_name text;
  assigned_role public.app_role;
begin
  requested_role :=
    lower(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'role',
          ''
        )
      )
    );

  matched_trainer_id := null;
  matched_trainer_name := null;

  if requested_role = 'trainer'
     and new.email is not null
     and trim(new.email) <> ''
  then
    select
      trainer.id,
      trainer.full_name
    into
      matched_trainer_id,
      matched_trainer_name
    from public.trainers
      as trainer
    where trainer.is_active = true
      and trainer.profile_id is null
      and trainer.email is not null
      and lower(trim(trainer.email)) =
          lower(trim(new.email))
    order by trainer.id
    limit 1;
  end if;

  assigned_role :=
    case
      when matched_trainer_id is not null
        then 'trainer'::public.app_role
      else 'pending'::public.app_role
    end;

  profile_name :=
    coalesce(
      nullif(
        trim(matched_trainer_name),
        ''
      ),
      nullif(
        trim(
          new.raw_user_meta_data ->> 'full_name'
        ),
        ''
      ),
      nullif(
        split_part(
          coalesce(new.email, ''),
          '@',
          1
        ),
        ''
      ),
      'User'
    );

  insert into public.profiles (
    id,
    full_name,
    email,
    role
  )
  values (
    new.id,
    profile_name,
    coalesce(new.email, ''),
    assigned_role
  )
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    email = excluded.email,
    updated_at = now();

  if matched_trainer_id is not null then
    update public.trainers
    set
      profile_id = new.id,
      updated_at = now()
    where id = matched_trainer_id
      and profile_id is null;

    if not found then
      update public.profiles
      set
        role = 'pending'::public.app_role,
        updated_at = now()
      where id = new.id;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Creates new profiles with least privilege. A trainer role is granted only when the signup email matches an active pre-registered unlinked trainer.';

-- ----------------------------------------------------------------------------
-- Capability-based trainer identity.
--
-- HODs/system administrators may also teach. Keep their administrative role
-- while allowing a linked active trainer record to drive staff-workspace RLS.
-- ----------------------------------------------------------------------------

create or replace function public.current_trainer_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select trainer.id
  from public.trainers as trainer
  join public.profiles as profile
    on profile.id =
       trainer.profile_id
  where trainer.profile_id =
      auth.uid()
    and trainer.is_active = true
    and profile.is_active = true
    and profile.role::text in (
      'trainer',
      'hod',
      'system_admin'
    )
  limit 1;
$$;

revoke all
on function public.current_trainer_id()
from public;

grant execute
on function public.current_trainer_id()
to authenticated;

comment on function public.current_trainer_id() is
  'Returns the active trainer linked to the authenticated trainer, HOD or system-admin profile.';

-- ----------------------------------------------------------------------------
-- Harden the V9 manual linking helper.
--
-- A HOD/system administrator may promote a PENDING matching profile or link an
-- existing TRAINER profile. Administrative profiles are never silently
-- demoted to trainer.
-- ----------------------------------------------------------------------------

create or replace function public.provision_trainer_access(
  target_trainer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  trainer_row record;
  profile_row record;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may provision trainer access.'
      using errcode = '42501';
  end if;

  select
    trainer.id,
    trainer.full_name,
    trainer.email,
    trainer.profile_id,
    trainer.is_active
  into trainer_row
  from public.trainers
    as trainer
  where trainer.id =
    target_trainer_id
  for update;

  if not found then
    raise exception
      'Trainer was not found.'
      using errcode = 'P0002';
  end if;

  if trainer_row.is_active = false then
    raise exception
      'Activate the trainer before provisioning staff access.'
      using errcode = '23514';
  end if;

  if trainer_row.email is null
     or trim(trainer_row.email) = ''
  then
    raise exception
      'The trainer must have an email address before staff access can be provisioned.'
      using errcode = '23514';
  end if;

  if trainer_row.profile_id is not null then
    select
      profile.id,
      profile.email,
      profile.role::text as role,
      profile.is_active
    into profile_row
    from public.profiles
      as profile
    where profile.id =
      trainer_row.profile_id;

    if not found then
      raise exception
        'The linked trainer profile no longer exists.'
        using errcode = 'P0002';
    end if;

    if profile_row.role not in (
      'trainer',
      'hod',
      'system_admin'
    ) then
      raise exception
        'The linked profile cannot use the staff workspace. Review this account before continuing.'
        using errcode = '23514';
    end if;

    if profile_row.is_active = false then
      raise exception
        'The linked trainer profile is inactive.'
        using errcode = '23514';
    end if;

    return jsonb_build_object(
      'trainerId',
      target_trainer_id,
      'profileId',
      profile_row.id,
      'email',
      profile_row.email,
      'role',
      profile_row.role,
      'status',
      'linked'
    );
  end if;

  select
    profile.id,
    profile.email,
    profile.role::text as role,
    profile.is_active
  into profile_row
  from public.profiles
    as profile
  where lower(trim(profile.email)) =
    lower(trim(trainer_row.email))
  limit 1;

  if not found then
    raise exception
      'No account matches this trainer email. Ask the trainer to create a staff account first.'
      using errcode = 'P0002';
  end if;

  if profile_row.is_active = false then
    raise exception
      'The matching account is inactive.'
      using errcode = '23514';
  end if;

  if profile_row.role = 'pending' then
    update public.profiles
    set
      role = 'trainer'::public.app_role,
      updated_at = now()
    where id = profile_row.id;

    profile_row.role := 'trainer';
  elsif profile_row.role not in (
    'trainer',
    'hod',
    'system_admin'
  ) then
    raise exception
      'The matching account has an unsupported role.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.trainers
      as another_trainer
    where another_trainer.profile_id =
        profile_row.id
      and another_trainer.id <>
        target_trainer_id
  ) then
    raise exception
      'This account is already linked to another trainer.'
      using errcode = '23505';
  end if;

  update public.trainers
  set
    profile_id = profile_row.id,
    updated_at = now()
  where id =
    target_trainer_id;

  return jsonb_build_object(
    'trainerId',
    target_trainer_id,
    'profileId',
    profile_row.id,
    'email',
    profile_row.email,
    'role',
    profile_row.role,
    'status',
    'linked'
  );
end;
$$;

revoke all
on function public.provision_trainer_access(uuid)
from public;

grant execute
on function public.provision_trainer_access(uuid)
to authenticated;

comment on function public.provision_trainer_access(uuid) is
  'Links an active trainer to a matching profile. Pending profiles become trainers; HOD/system-admin roles are preserved.';

-- ----------------------------------------------------------------------------
-- Compact HOD/system-admin access register.
-- ----------------------------------------------------------------------------

create or replace function public.get_trainer_access_register()
returns table (
  trainer_id uuid,
  full_name text,
  email text,
  trainer_active boolean,
  linked_profile_id uuid,
  matched_profile_id uuid,
  profile_role text,
  profile_active boolean,
  access_state text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not public.current_user_has_role(
       array[
         'hod',
         'system_admin'
       ]::public.app_role[]
     )
  then
    raise exception
      'Only an authorized HOD or system administrator may view the trainer access register.'
      using errcode = '42501';
  end if;

  return query
  select
    trainer.id,
    trainer.full_name,
    trainer.email,
    trainer.is_active,
    trainer.profile_id,
    coalesce(
      linked_profile.id,
      email_profile.id
    ),
    coalesce(
      linked_profile.role::text,
      email_profile.role::text
    ),
    coalesce(
      linked_profile.is_active,
      email_profile.is_active
    ),
    case
      when trainer.is_active = false
        then 'inactive'

      when trainer.email is null
        or trim(trainer.email) = ''
        then 'email_required'

      when trainer.profile_id is not null
        and linked_profile.id is null
        then 'review'

      when trainer.profile_id is not null
        and linked_profile.role::text in (
          'trainer',
          'hod',
          'system_admin'
        )
        and linked_profile.is_active = true
        then 'linked'

      when trainer.profile_id is not null
        then 'review'

      when email_profile.id is null
        then 'account_required'

      when email_profile.is_active = false
        then 'review'

      when email_profile.role::text in (
        'trainer',
        'pending',
        'hod',
        'system_admin'
      )
        then 'ready_to_link'

      else 'review'
    end
  from public.trainers
    as trainer
  left join public.profiles
    as linked_profile
    on linked_profile.id =
      trainer.profile_id
  left join lateral (
    select
      candidate.id,
      candidate.role,
      candidate.is_active
    from public.profiles
      as candidate
    where trainer.profile_id is null
      and trainer.email is not null
      and lower(trim(candidate.email)) =
          lower(trim(trainer.email))
    order by candidate.created_at
    limit 1
  ) as email_profile
    on true
  order by
    trainer.is_active desc,
    trainer.full_name asc;
end;
$$;

revoke all
on function public.get_trainer_access_register()
from public;

grant execute
on function public.get_trainer_access_register()
to authenticated;

comment on function public.get_trainer_access_register() is
  'HOD/system-admin staff access register derived from trainer/profile linkage without exposing the profile directory to trainers.';

commit;
