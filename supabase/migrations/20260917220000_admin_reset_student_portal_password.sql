-- Migration: Admin RPC for resetting student portal password
-- Allows HODs and administrators to set a custom or temporary password (min 4 characters)
-- for any student, updating student_portal_credentials securely using bcrypt.
--
-- Permission model:
--   - When called by an authenticated user (auth.uid() IS NOT NULL), the department
--     membership is verified via current_user_can_manage_department().
--   - When called with the service role key (auth.uid() IS NULL), the permission
--     check is skipped because the calling API route (/api/admin/students/[id]/reset-password)
--     already gates access behind HOD / system_admin role verification server-side.

create or replace function public.reset_student_portal_password(
  target_student_id uuid,
  plain_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_pwd text;
  selected_department uuid;
begin
  clean_pwd := trim(plain_password);
  if length(clean_pwd) < 4 then
    raise exception using errcode = '22023', message = 'Password must be at least 4 characters';
  end if;

  select student.department_id
  into selected_department
  from public.students as student
  where student.id = target_student_id;

  if selected_department is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;

  -- Only enforce department membership check for regular authenticated users.
  -- Service-role callers (auth.uid() IS NULL) have already been gated by the
  -- server-side API route which verifies HOD / system_admin credentials.
  if auth.uid() is not null
    and not public.current_user_can_manage_department(selected_department)
  then
    raise exception using errcode = '42501', message = 'Not permitted to manage this student';
  end if;

  insert into public.student_portal_credentials (
    student_id,
    pin_hash,
    is_active,
    issued_at,
    created_at,
    issued_by,
    failed_login_attempts,
    locked_until,
    updated_at
  )
  values (
    target_student_id,
    extensions.crypt(clean_pwd, extensions.gen_salt('bf')),
    true,
    now(),
    now(),
    auth.uid(),
    0,
    null,
    now()
  )
  on conflict (student_id) do update
  set
    pin_hash = extensions.crypt(clean_pwd, extensions.gen_salt('bf')),
    is_active = true,
    failed_login_attempts = 0,
    locked_until = null,
    updated_at = now();
end;
$$;

-- Grant execution permission to authenticated users (service role bypasses this automatically)
grant execute on function public.reset_student_portal_password(uuid, text) to authenticated;

