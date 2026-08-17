-- ============================================================
-- v12.6g — Standard Academic Stage Structures
-- ============================================================
-- Programme progression standards:
-- CHN/CND  : Y1S1 -> Y2S3
-- DHN/DND  : Y1S1 -> Y3S3
-- DHNT/DNDT: Y1S1 -> Y2S1
--
-- This migration DOES NOT assign units automatically.
-- It only creates/normalizes the stage structure for a programme.

create or replace function public.generate_standard_programme_stages(
  target_programme_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  programme_row public.programmes%rowtype;
  labels text[];
  stage_label text;
  ordinal integer := 0;
begin
  select *
  into programme_row
  from public.programmes
  where id = target_programme_id;

  if programme_row.id is null then
    raise exception using errcode = 'P0002', message = 'Programme not found';
  end if;

  if not public.current_user_can_manage_department(programme_row.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to manage this programme';
  end if;

  case upper(trim(programme_row.code))
    when 'CHN' then
      labels := array['Y1S1','Y1S2','Y1S3','Y2S1','Y2S2','Y2S3'];
    when 'CND' then
      labels := array['Y1S1','Y1S2','Y1S3','Y2S1','Y2S2','Y2S3'];
    when 'DHN' then
      labels := array['Y1S1','Y1S2','Y1S3','Y2S1','Y2S2','Y2S3','Y3S1','Y3S2','Y3S3'];
    when 'DND' then
      labels := array['Y1S1','Y1S2','Y1S3','Y2S1','Y2S2','Y2S3','Y3S1','Y3S2','Y3S3'];
    when 'DHNT' then
      labels := array['Y1S1','Y1S2','Y1S3','Y2S1'];
    when 'DNDT' then
      labels := array['Y1S1','Y1S2','Y1S3','Y2S1'];
    else
      raise exception using errcode = '22023',
        message = 'No standard academic stage range is configured for this programme';
  end case;

  foreach stage_label in array labels loop
    ordinal := ordinal + 1;

    insert into public.programme_stages (
      department_id,
      programme_id,
      stage_number,
      name,
      is_active,
      created_by,
      updated_at
    )
    values (
      programme_row.department_id,
      programme_row.id,
      ordinal,
      stage_label,
      true,
      auth.uid(),
      now()
    )
    on conflict (programme_id, stage_number)
    do update set
      name = excluded.name,
      is_active = true,
      updated_at = now();
  end loop;

  -- Do not delete historical stages or unit bindings.
  -- If this programme previously contained extra generic stages beyond
  -- the standard range, simply deactivate unused extras when they are
  -- not referenced by a student's current stage.
  update public.programme_stages ps
  set is_active = false,
      updated_at = now()
  where ps.programme_id = programme_row.id
    and ps.stage_number > cardinality(labels)
    and not exists (
      select 1
      from public.students s
      where s.current_stage_id = ps.id
    );

  return cardinality(labels);
end;
$$;

revoke all on function public.generate_standard_programme_stages(uuid) from public, anon;
grant execute on function public.generate_standard_programme_stages(uuid) to authenticated;

comment on function public.generate_standard_programme_stages(uuid) is
  'Creates the standard YxSy academic progression structure for CHN/CND, DHN/DND and DHNT/DNDT without assigning units.';
