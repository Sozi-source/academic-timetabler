-- Correct legacy trainer classifications before applying role-based targets.
-- HOD can be inferred only from a linked application profile. Course
-- coordinators must be explicitly selected on the trainer record or import.

-- Link a trainer to the matching account when both use the same unique email.
update public.trainers trainer
set profile_id = profile.id
from public.profiles profile
where trainer.profile_id is null
  and trainer.email is not null
  and lower(trim(trainer.email)) = lower(trim(profile.email))
  and not exists (
    select 1
    from public.trainers linked
    where linked.profile_id = profile.id
      and linked.id <> trainer.id
  );

-- A linked HOD account is authoritative for the trainer workload role.
update public.trainers trainer
set workload_role = 'hod'
from public.profiles profile
where trainer.profile_id = profile.id
  and profile.role = 'hod'
  and trainer.workload_role <> 'hod';

-- Re-apply the standard target for every explicitly stored role.
update public.trainers
set normal_weekly_hours = case workload_role
  when 'hod' then 10
  when 'course_coordinator' then 16
  when 'full_time_trainer' then 20
  else normal_weekly_hours
end;

comment on column public.trainers.workload_role is
  'Determines weekly target: HOD 10h, course coordinator 16h, full-time trainer 20h; part-time and external targets are custom.';
