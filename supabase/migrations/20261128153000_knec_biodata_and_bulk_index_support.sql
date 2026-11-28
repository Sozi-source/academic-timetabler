-- Add birth certificate entry number to students & profile verification history
-- Required alongside KCSE index number, National ID, and phone number before Module I KNEC booking.

begin;

alter table public.students
  add column if not exists birth_certificate_entry_number text;

alter table public.student_profile_verifications
  add column if not exists birth_certificate_entry_number text;

create index if not exists students_birth_cert_entry_idx
  on public.students (lower(trim(birth_certificate_entry_number)))
  where birth_certificate_entry_number is not null and trim(birth_certificate_entry_number) <> '';

commit;
