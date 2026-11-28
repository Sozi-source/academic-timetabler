-- KNEC Examination Series, Module/Paper Catalog, Student Booking Engine & Progress Tracking.
-- Additive migration: preserves all existing academic tables and data.

begin;

-- 1. Optional persistent KNEC index number on students for quick lookup across series
alter table public.students
  add column if not exists knec_index_number text;

create index if not exists students_knec_index_number_idx
  on public.students (lower(trim(knec_index_number)))
  where knec_index_number is not null and trim(knec_index_number) <> '';

-- 2. KNEC Modules catalog (scoped per department)
create table if not exists public.knec_modules (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  course_family text not null,
  module_code text not null,
  module_number smallint not null check (module_number between 1 and 4),
  title text not null,
  sequence_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, module_code)
);

create index if not exists knec_modules_dept_seq_idx
  on public.knec_modules (department_id, sequence_order, module_code);

alter table public.knec_modules enable row level security;
revoke all on table public.knec_modules from anon, authenticated;
grant select, insert, update, delete on table public.knec_modules to authenticated;

drop policy if exists knec_modules_read on public.knec_modules;
create policy knec_modules_read on public.knec_modules
  for select to authenticated
  using (public.current_user_can_access_department(department_id));

drop policy if exists knec_modules_manage on public.knec_modules;
create policy knec_modules_manage on public.knec_modules
  for all to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

-- 3. KNEC Papers catalog
create table if not exists public.knec_papers (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.knec_modules(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  paper_code text not null,
  paper_number text not null,
  paper_name text not null,
  paper_type text not null default 'theory'
    check (paper_type in ('theory', 'practice', 'trade_project', 'coursework')),
  sort_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, paper_code)
);

create index if not exists knec_papers_module_idx
  on public.knec_papers (module_id, sort_order, paper_code);

alter table public.knec_papers enable row level security;
revoke all on table public.knec_papers from anon, authenticated;
grant select, insert, update, delete on table public.knec_papers to authenticated;

drop policy if exists knec_papers_read on public.knec_papers;
create policy knec_papers_read on public.knec_papers
  for select to authenticated
  using (public.current_user_can_access_department(department_id));

drop policy if exists knec_papers_manage on public.knec_papers;
create policy knec_papers_manage on public.knec_papers
  for all to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

-- 4. Programme -> Required KNEC Modules rules
-- Handles equivalence (CHN/CND share 1905/1-2; DHN/DND share 2916/1-3;
-- DHNT/DNDT require Cert 1905/1-2 cleared + Diploma 2916/2 & 2916/3).
create table if not exists public.knec_programme_module_rules (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete set null,
  programme_code text not null,
  module_id uuid not null references public.knec_modules(id) on delete cascade,
  requirement_role text not null default 'core'
    check (requirement_role in ('core', 'prerequisite_cert', 'transition_core')),
  display_order integer not null default 1,
  created_at timestamptz not null default now(),
  unique (department_id, programme_code, module_id)
);

create index if not exists knec_programme_module_rules_prog_idx
  on public.knec_programme_module_rules (department_id, programme_code, display_order);

alter table public.knec_programme_module_rules enable row level security;
revoke all on table public.knec_programme_module_rules from anon, authenticated;
grant select, insert, update, delete on table public.knec_programme_module_rules to authenticated;

drop policy if exists knec_programme_module_rules_read on public.knec_programme_module_rules;
create policy knec_programme_module_rules_read on public.knec_programme_module_rules
  for select to authenticated
  using (public.current_user_can_access_department(department_id));

drop policy if exists knec_programme_module_rules_manage on public.knec_programme_module_rules;
create policy knec_programme_module_rules_manage on public.knec_programme_module_rules
  for all to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

-- 5. KNEC Examination Series Registry (e.g. March 2026, July 2026, November 2026)
create table if not exists public.knec_exam_series (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  series_code text not null,
  series_name text not null,
  series_month text not null,
  series_year integer not null check (series_year between 2015 and 2100),
  status text not null default 'planned'
    check (status in ('planned', 'booking_open', 'booking_closed', 'in_progress', 'results_released', 'archived')),
  booking_opens_on date,
  booking_closes_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, series_year, series_month)
);

create index if not exists knec_exam_series_dept_year_idx
  on public.knec_exam_series (department_id, series_year desc, status);

alter table public.knec_exam_series enable row level security;
revoke all on table public.knec_exam_series from anon, authenticated;
grant select, insert, update, delete on table public.knec_exam_series to authenticated;

drop policy if exists knec_exam_series_read on public.knec_exam_series;
create policy knec_exam_series_read on public.knec_exam_series
  for select to authenticated
  using (public.current_user_can_access_department(department_id));

drop policy if exists knec_exam_series_manage on public.knec_exam_series;
create policy knec_exam_series_manage on public.knec_exam_series
  for all to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

-- 6. Student Module Progress Baseline & Computed Statuses
create table if not exists public.student_knec_module_statuses (
  student_id uuid not null references public.students(id) on delete cascade,
  module_id uuid not null references public.knec_modules(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('completed', 'booked', 'resit', 'pending', 'exempt')),
  completion_source text not null default 'derived'
    check (completion_source in ('historical_import', 'booking_results', 'manual_override', 'derived')),
  completed_series_id uuid references public.knec_exam_series(id) on delete set null,
  knec_index_number text,
  resit_paper_codes text[] not null default '{}',
  notes text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (student_id, module_id)
);

create index if not exists student_knec_module_statuses_dept_idx
  on public.student_knec_module_statuses (department_id, status, student_id);

alter table public.student_knec_module_statuses enable row level security;
revoke all on table public.student_knec_module_statuses from anon, authenticated;
grant select, insert, update, delete on table public.student_knec_module_statuses to authenticated;

drop policy if exists student_knec_module_statuses_read on public.student_knec_module_statuses;
create policy student_knec_module_statuses_read on public.student_knec_module_statuses
  for select to authenticated
  using (public.current_user_can_access_department(department_id));

drop policy if exists student_knec_module_statuses_manage on public.student_knec_module_statuses;
create policy student_knec_module_statuses_manage on public.student_knec_module_statuses
  for all to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

-- 7. Student KNEC Series Bookings (Header per student + series)
create table if not exists public.student_knec_bookings (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  series_id uuid not null references public.knec_exam_series(id) on delete restrict,
  knec_index_number text,
  booking_type text not null default 'normal'
    check (booking_type in ('normal', 'resit', 'mixed', 'historical')),
  booking_status text not null default 'submitted'
    check (booking_status in ('draft', 'submitted', 'hod_cleared', 'registered_knec', 'sat', 'results_recorded', 'cancelled')),
  clearance_ref text,
  submitted_at timestamptz default now(),
  hod_cleared_at timestamptz,
  hod_cleared_by uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, series_id)
);

create index if not exists student_knec_bookings_series_idx
  on public.student_knec_bookings (department_id, series_id, booking_status);

create index if not exists student_knec_bookings_student_idx
  on public.student_knec_bookings (student_id, created_at desc);

alter table public.student_knec_bookings enable row level security;
revoke all on table public.student_knec_bookings from anon, authenticated;
grant select, insert, update, delete on table public.student_knec_bookings to authenticated;

drop policy if exists student_knec_bookings_read on public.student_knec_bookings;
create policy student_knec_bookings_read on public.student_knec_bookings
  for select to authenticated
  using (public.current_user_can_access_department(department_id));

drop policy if exists student_knec_bookings_manage on public.student_knec_bookings;
create policy student_knec_bookings_manage on public.student_knec_bookings
  for all to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

-- 8. Student KNEC Booked Papers & Results Detail
create table if not exists public.student_knec_booking_papers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.student_knec_bookings(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  series_id uuid not null references public.knec_exam_series(id) on delete restrict,
  module_id uuid not null references public.knec_modules(id) on delete restrict,
  paper_id uuid references public.knec_papers(id) on delete set null,
  paper_code text not null,
  paper_name text not null,
  is_resit boolean not null default false,
  paper_status text not null default 'booked'
    check (paper_status in ('booked', 'sat', 'passed', 'referred', 'absent', 'cancelled')),
  grade text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, paper_code)
);

create index if not exists student_knec_booking_papers_student_idx
  on public.student_knec_booking_papers (student_id, series_id, module_id);

alter table public.student_knec_booking_papers enable row level security;
revoke all on table public.student_knec_booking_papers from anon, authenticated;
grant select, insert, update, delete on table public.student_knec_booking_papers to authenticated;

drop policy if exists student_knec_booking_papers_read on public.student_knec_booking_papers;
create policy student_knec_booking_papers_read on public.student_knec_booking_papers
  for select to authenticated
  using (public.current_user_can_access_department(department_id));

drop policy if exists student_knec_booking_papers_manage on public.student_knec_booking_papers;
create policy student_knec_booking_papers_manage on public.student_knec_booking_papers
  for all to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

-- 9. Seed Authoritative KNEC Modules, Papers, Programme Rules, and Exam Series for HND
do $$
declare
  v_dept_id uuid;
  v_m_1905_1 uuid;
  v_m_1905_2 uuid;
  v_m_2916_1 uuid;
  v_m_2916_2 uuid;
  v_m_2916_3 uuid;
  v_m_1903_1 uuid;
  v_m_1903_2 uuid;
  v_m_2913_1 uuid;
  v_m_2913_2 uuid;
  v_m_2913_3 uuid;
begin
  select id into v_dept_id
  from public.departments
  where upper(code) = 'HND'
  limit 1;

  if v_dept_id is null then
    return;
  end if;

  -- Modules
  insert into public.knec_modules (department_id, course_family, module_code, module_number, title, sequence_order)
  values
    (v_dept_id, '1905', '1905/1', 1, 'Certificate in Nutrition and Dietetics - Module I', 1),
    (v_dept_id, '1905', '1905/2', 2, 'Certificate in Nutrition and Dietetics - Module II', 2),
    (v_dept_id, '2916', '2916/1', 1, 'Diploma in Nutrition and Dietetics - Module I', 3),
    (v_dept_id, '2916', '2916/2', 2, 'Diploma in Nutrition and Dietetics - Module II', 4),
    (v_dept_id, '2916', '2916/3', 3, 'Diploma in Nutrition and Dietetics - Module III', 5),
    (v_dept_id, '1903', '1903/1', 1, 'Certificate in Food Processing and Preservation - Module I', 6),
    (v_dept_id, '1903', '1903/2', 2, 'Certificate in Food Processing and Preservation - Module II', 7),
    (v_dept_id, '2913', '2913/1', 1, 'Diploma in Food Processing and Preservation - Module I', 8),
    (v_dept_id, '2913', '2913/2', 2, 'Diploma in Food Processing and Preservation - Module II', 9),
    (v_dept_id, '2913', '2913/3', 3, 'Diploma in Food Processing and Preservation - Module III', 10)
  on conflict (department_id, module_code) do update
    set title = excluded.title,
        course_family = excluded.course_family,
        module_number = excluded.module_number,
        sequence_order = excluded.sequence_order;

  select id into v_m_1905_1 from public.knec_modules where department_id = v_dept_id and module_code = '1905/1';
  select id into v_m_1905_2 from public.knec_modules where department_id = v_dept_id and module_code = '1905/2';
  select id into v_m_2916_1 from public.knec_modules where department_id = v_dept_id and module_code = '2916/1';
  select id into v_m_2916_2 from public.knec_modules where department_id = v_dept_id and module_code = '2916/2';
  select id into v_m_2916_3 from public.knec_modules where department_id = v_dept_id and module_code = '2916/3';
  select id into v_m_1903_1 from public.knec_modules where department_id = v_dept_id and module_code = '1903/1';
  select id into v_m_1903_2 from public.knec_modules where department_id = v_dept_id and module_code = '1903/2';
  select id into v_m_2913_1 from public.knec_modules where department_id = v_dept_id and module_code = '2913/1';
  select id into v_m_2913_2 from public.knec_modules where department_id = v_dept_id and module_code = '2913/2';
  select id into v_m_2913_3 from public.knec_modules where department_id = v_dept_id and module_code = '2913/3';

  -- Authoritative Papers from Nutrition KNEC Papers (1).xlsx + Trade Projects 1905/207 & 2916/307
  insert into public.knec_papers (module_id, department_id, paper_code, paper_number, paper_name, paper_type, sort_order)
  values
    -- 1905/1
    (v_m_1905_1, v_dept_id, '1905/101', '101', 'ICT, Mathematics and Entrepreneurship', 'theory', 1),
    (v_m_1905_1, v_dept_id, '1905/102', '102', 'Applied Physical Sciences, Applied Biological Sciences, Anatomy and Physiology', 'theory', 2),
    (v_m_1905_1, v_dept_id, '1905/103', '103', 'Food Science, Food Safety and Hygiene, Meal Planning Management and Service Practice', 'practice', 3),
    (v_m_1905_1, v_dept_id, '1905/104', '104', 'Food Science, Food Safety and Hygiene, Meal Planning Management and Service Theory', 'theory', 4),
    (v_m_1905_1, v_dept_id, '1905/105', '105', 'Introduction to Nutrition and Dietetics, Introduction to Nutrition Care Process, and Principles of Human Nutrition', 'theory', 5),
    (v_m_1905_1, v_dept_id, '1905/106', '106', 'Legal Aspects of Nutrition and Dietetics, HIV and AIDS, Introduction to Primary Health Care', 'theory', 6),
    -- 1905/2
    (v_m_1905_2, v_dept_id, '1905/201', '201', 'Communications Skills', 'theory', 1),
    (v_m_1905_2, v_dept_id, '1905/202', '202', 'Community Diagnosis & Mobilization, Introduction to Nutrition Surveillance and Nutrition in Emergency', 'theory', 2),
    (v_m_1905_2, v_dept_id, '1905/203', '203', 'Diet Therapy and Demonstration Techniques Practice', 'practice', 3),
    (v_m_1905_2, v_dept_id, '1905/204', '204', 'Diet Therapy (Theory), Nutrition in HIV& AIDS and Management of Malnutrition', 'theory', 4),
    (v_m_1905_2, v_dept_id, '1905/205', '205', 'Food Production for Invalids and Convalescents, Introduction to Behavioural Science and Nutrition Anthropology', 'theory', 5),
    (v_m_1905_2, v_dept_id, '1905/206', '206', 'Maternal and Child Nutrition, Nutrition in the Lifecycle and Nutrition for Vulnerable Groups', 'theory', 6),
    (v_m_1905_2, v_dept_id, '1905/207', '207', 'Trade Project', 'trade_project', 7),
    -- 2916/1
    (v_m_2916_1, v_dept_id, '2916/101', '101', 'ICT, Communication Skills and Entrepreneurship', 'theory', 1),
    (v_m_2916_1, v_dept_id, '2916/102', '102', 'Mathematics and Physical Science', 'theory', 2),
    (v_m_2916_1, v_dept_id, '2916/103', '103', 'Diet Therapy I, Meal Planning Management and Service and Principles Of Human Nutrition Practice', 'practice', 3),
    (v_m_2916_1, v_dept_id, '2916/104', '104', 'Diet Therapy I, Principles of Human Nutrition, Introduction to Nutrition and Dietetics, Anatomy and Physiology Theory', 'theory', 4),
    (v_m_2916_1, v_dept_id, '2916/105', '105', 'Legal Aspects of Nutrition, HIV & AIDS, Nutrition in HIV & AIDS, Maternal and Child Health', 'theory', 5),
    (v_m_2916_1, v_dept_id, '2916/106', '106', 'Food Safety and Hygiene, Food Production for Invalids and Convalescents and Nutrition Anthropology', 'theory', 6),
    -- 2916/2
    (v_m_2916_2, v_dept_id, '2916/201', '201', 'Basic Biochemistry and Introduction to Biostatistics', 'theory', 1),
    (v_m_2916_2, v_dept_id, '2916/202', '202', 'Diet Therapy II and Nutrition in the Lifespan Practice', 'practice', 2),
    (v_m_2916_2, v_dept_id, '2916/203', '203', 'Diet Therapy II and Nutrition in the Lifespan Theory', 'theory', 3),
    (v_m_2916_2, v_dept_id, '2916/204', '204', 'Introduction to Microbiology, First Aid and Principles of Food Processing and Preservation', 'theory', 4),
    (v_m_2916_2, v_dept_id, '2916/205', '205', 'Introduction to Primary Health Care and Principles of Nutrition and Behaviour', 'theory', 5),
    -- 2916/3
    (v_m_2916_3, v_dept_id, '2916/301', '301', 'Food Microbiology, Parasitology and Food Security', 'theory', 1),
    (v_m_2916_3, v_dept_id, '2916/302', '302', 'Diet Therapy III and Nutrition Education and Counselling Practice', 'practice', 2),
    (v_m_2916_3, v_dept_id, '2916/303', '303', 'Diet Therapy III and Nutrition Education and Counselling Theory', 'theory', 3),
    (v_m_2916_3, v_dept_id, '2916/304', '304', 'Communicable and Non-Communicable Diseases and Nutrition Epidemiology', 'theory', 4),
    (v_m_2916_3, v_dept_id, '2916/305', '305', 'Community Partnership Skills, Nutrition Assessment and Surveillance and Nutrition in Emergency', 'theory', 5),
    (v_m_2916_3, v_dept_id, '2916/306', '306', 'Industrial Organization and management, Product Development, Marketing and Sales.', 'theory', 6),
    (v_m_2916_3, v_dept_id, '2916/307', '307', 'Trade Project', 'trade_project', 7),
    -- Reference papers for Food Processing & Preservation (DFP / DFPT in historical progress file)
    (v_m_1903_2, v_dept_id, '1903/201', '201', 'Food Processing Paper 201', 'theory', 1),
    (v_m_1903_2, v_dept_id, '1903/202', '202', 'Food Processing Paper 202', 'theory', 2),
    (v_m_1903_2, v_dept_id, '1903/203', '203', 'Food Processing Paper 203', 'theory', 3),
    (v_m_1903_2, v_dept_id, '1903/204', '204', 'Food Processing Paper 204', 'theory', 4),
    (v_m_1903_2, v_dept_id, '1903/205', '205', 'Food Processing Paper 205', 'theory', 5),
    (v_m_1903_2, v_dept_id, '1903/206', '206', 'Food Processing Paper 206', 'theory', 6),
    (v_m_2913_2, v_dept_id, '2913/201', '201', 'Diploma Food Processing Paper 201', 'theory', 1),
    (v_m_2913_2, v_dept_id, '2913/202', '202', 'Diploma Food Processing Paper 202', 'theory', 2),
    (v_m_2913_2, v_dept_id, '2913/203', '203', 'Diploma Food Processing Paper 203', 'theory', 3),
    (v_m_2913_2, v_dept_id, '2913/204', '204', 'Diploma Food Processing Paper 204', 'theory', 4),
    (v_m_2913_2, v_dept_id, '2913/205', '205', 'Diploma Food Processing Paper 205', 'theory', 5),
    (v_m_2913_2, v_dept_id, '2913/206', '206', 'Diploma Food Processing Paper 206', 'theory', 6)
  on conflict (module_id, paper_code) do update
    set paper_name = excluded.paper_name,
        paper_type = excluded.paper_type,
        sort_order = excluded.sort_order;

  -- Programme rules (matching exact equivalence: CHN=CND, DHN=DND, DHNT=DNDT transition)
  insert into public.knec_programme_module_rules (department_id, programme_id, programme_code, module_id, requirement_role, display_order)
  select
    v_dept_id,
    p.id,
    r.programme_code,
    r.module_id,
    r.requirement_role,
    r.display_order
  from (
    values
      ('CHN', v_m_1905_1, 'core', 1),
      ('CHN', v_m_1905_2, 'core', 2),
      ('CND', v_m_1905_1, 'core', 1),
      ('CND', v_m_1905_2, 'core', 2),
      ('DHN', v_m_2916_1, 'core', 1),
      ('DHN', v_m_2916_2, 'core', 2),
      ('DHN', v_m_2916_3, 'core', 3),
      ('DND', v_m_2916_1, 'core', 1),
      ('DND', v_m_2916_2, 'core', 2),
      ('DND', v_m_2916_3, 'core', 3),
      ('DHNT', v_m_1905_1, 'prerequisite_cert', 1),
      ('DHNT', v_m_1905_2, 'prerequisite_cert', 2),
      ('DHNT', v_m_2916_2, 'transition_core', 3),
      ('DHNT', v_m_2916_3, 'transition_core', 4),
      ('DNDT', v_m_1905_1, 'prerequisite_cert', 1),
      ('DNDT', v_m_1905_2, 'prerequisite_cert', 2),
      ('DNDT', v_m_2916_2, 'transition_core', 3),
      ('DNDT', v_m_2916_3, 'transition_core', 4),
      ('DFP', v_m_2913_1, 'core', 1),
      ('DFP', v_m_2913_2, 'core', 2),
      ('DFP', v_m_2913_3, 'core', 3),
      ('DFPT', v_m_1903_1, 'prerequisite_cert', 1),
      ('DFPT', v_m_1903_2, 'prerequisite_cert', 2),
      ('DFPT', v_m_2913_2, 'transition_core', 3),
      ('DFPT', v_m_2913_3, 'transition_core', 4)
  ) as r(programme_code, module_id, requirement_role, display_order)
  left join public.programmes p
    on p.department_id = v_dept_id
   and upper(p.code) = upper(r.programme_code)
  on conflict (department_id, programme_code, module_id) do update
    set programme_id = excluded.programme_id,
        requirement_role = excluded.requirement_role,
        display_order = excluded.display_order;

  -- Baseline KNEC Examination Series
  insert into public.knec_exam_series (department_id, series_code, series_name, series_month, series_year, status, notes)
  values
    (v_dept_id, 'MAR-2026', 'March 2026', 'March', 2026, 'results_released', 'Historical March 2026 KNEC series'),
    (v_dept_id, 'JUL-2026', 'July 2026', 'July', 2026, 'results_released', 'Historical July 2026 KNEC series'),
    (v_dept_id, 'NOV-2026', 'November 2026', 'November', 2026, 'in_progress', 'Active November 2026 KNEC series seeded from Students KNEC Progress.xlsx'),
    (v_dept_id, 'MAR-2027', 'March 2027', 'March', 2027, 'booking_open', 'Upcoming March 2027 KNEC booking window')
  on conflict (department_id, series_year, series_month) do nothing;
end $$;

commit;
