-- Prevent unit registration writes for students who are currently on attachment.
-- Existing registration records are preserved for audit/history.

create or replace function public.reject_attachment_unit_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.registration_status = 'registered'
    and exists (
      select 1
      from public.students s
      where s.id = new.student_id
        and s.academic_phase = 'attachment'
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'Students on attachment are not eligible for unit registration';
  end if;

  return new;
end;
$$;

create trigger reject_attachment_unit_registration_write
before insert or update of student_id, registration_status
on public.student_unit_registrations
for each row
execute function public.reject_attachment_unit_registration();

revoke all on function public.reject_attachment_unit_registration() from public, anon, authenticated;
