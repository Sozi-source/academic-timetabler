grant update on public.manual_trainer_timetable_entries to authenticated;

create policy manual_trainer_entries_update on public.manual_trainer_timetable_entries
for update to authenticated
using (
  created_by_department_id = public.current_user_primary_department_id()
  and public.current_user_can_manage_department(created_by_department_id)
)
with check (
  created_by_department_id = public.current_user_primary_department_id()
  and public.current_user_can_manage_department(created_by_department_id)
);

