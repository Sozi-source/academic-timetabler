import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { getEffectiveCohortLifecycle } from '@/features/cohorts/lifecycle';
import {
  generateCohortExportWorkbook,
  type CohortExportStudent,
} from '@/features/cohorts/workbook';
import type { Cohort, CohortRow } from '@/features/cohorts/types';
import { formatStudentStage } from '@/features/students/student-status-stage';
import { createAdminClient } from '@/lib/supabase/admin';

type QueryStudentRow = {
  id: string;
  admission_number: string;
  full_name: string;
  lifecycle_status: string;
  academic_phase: string;
  phone_number: string | null;
  email: string | null;
  details_verified_at: string | null;
  current_cohort_id: string | null;
  programme: { code: string; name: string } | { code: string; name: string }[] | null;
  current_cohort: {
    id: string;
    code: string;
    name: string;
    current_academic_period_number: number;
  } | {
    id: string;
    code: string;
    name: string;
    current_academic_period_number: number;
  }[] | null;
};

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(request: Request) {
  const profile = await requireHodAccess();
  const url = new URL(request.url);

  const programmeId = url.searchParams.get('programmeId')?.trim() || undefined;
  const status = url.searchParams.get('status')?.trim() || undefined;
  const availability = url.searchParams.get('availability')?.trim() || undefined;
  const search = url.searchParams.get('search')?.trim().toLowerCase() || undefined;
  const cohortId = url.searchParams.get('cohortId')?.trim() || undefined;

  const admin = createAdminClient();

  // 1. Fetch Department Details for metadata
  const { data: department } = await admin
    .from('departments')
    .select('name')
    .eq('id', profile.activeDepartmentId)
    .maybeSingle();

  const departmentName = department?.name ?? 'Nutrition & Health Sciences';

  // 2. Fetch Cohorts scoped to active department programmes
  let cohortQuery = admin
    .from('cohorts')
    .select(`
      id,
      programme_id,
      code,
      name,
      intake_date,
      expected_completion_date,
      current_academic_period_number,
      planned_size,
      actual_size,
      status,
      is_timetable_available,
      notes,
      created_by,
      updated_by,
      created_at,
      updated_at,
      programmes!inner (
        id,
        code,
        name,
        total_academic_periods,
        maximum_cohort_size,
        is_active,
        is_timetable_available,
        department_id
      )
    `)
    .eq('programmes.department_id', profile.activeDepartmentId)
    .order('status', { ascending: true })
    .order('intake_date', { ascending: false })
    .order('name', { ascending: true });

  if (cohortId) {
    cohortQuery = cohortQuery.eq('id', cohortId);
  }

  if (programmeId && programmeId !== 'all') {
    cohortQuery = cohortQuery.eq('programme_id', programmeId);
  }

  if (status && status !== 'all') {
    cohortQuery = cohortQuery.eq('status', status);
  }

  if (availability === 'available') {
    cohortQuery = cohortQuery.eq('is_timetable_available', true);
  } else if (availability === 'unavailable') {
    cohortQuery = cohortQuery.eq('is_timetable_available', false);
  }

  const [cohortsResult, studentsResult] = await Promise.all([
    cohortQuery,
    admin
      .from('students')
      .select(`
        id,
        admission_number,
        full_name,
        lifecycle_status,
        academic_phase,
        phone_number,
        email,
        details_verified_at,
        current_cohort_id,
        programme:programmes!students_programme_id_fkey(code, name),
        current_cohort:cohorts!students_current_cohort_id_fkey(id, code, name, current_academic_period_number)
      `)
      .eq('department_id', profile.activeDepartmentId)
      .order('full_name'),
  ]);

  if (cohortsResult.error) {
    return NextResponse.json(
      { message: `Unable to export cohort data: ${cohortsResult.error.message}` },
      { status: 500 },
    );
  }

  const rawCohorts = (cohortsResult.data ?? []) as unknown as CohortRow[];
  const rawStudents = (studentsResult.data ?? []) as unknown as QueryStudentRow[];

  // Calculate live enrolment per cohort
  const liveCounts = new Map<string, number>();
  for (const st of rawStudents) {
    if (st.current_cohort_id) {
      liveCounts.set(st.current_cohort_id, (liveCounts.get(st.current_cohort_id) ?? 0) + 1);
    }
  }

  // Map cohorts into full domain Cohort type
  let cohorts: Cohort[] = rawCohorts.map((row) => {
    const programmeData = relation(row.programmes);
    const lifecycle = getEffectiveCohortLifecycle({
      status: row.status,
      intakeDate: row.intake_date,
      expectedCompletionDate: row.expected_completion_date,
      isTimetableAvailable: row.is_timetable_available,
    });

    const live = liveCounts.get(row.id);

    return {
      id: row.id,
      programmeId: row.programme_id,
      code: row.code,
      name: row.name,
      intakeDate: row.intake_date,
      expectedCompletionDate: row.expected_completion_date,
      currentAcademicPeriodNumber: row.current_academic_period_number,
      plannedSize: row.planned_size,
      actualSize: live !== undefined ? live : row.actual_size,
      status: lifecycle.status,
      isTimetableAvailable: lifecycle.isTimetableAvailable,
      notes: row.notes,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      programme: programmeData
        ? {
            id: programmeData.id,
            code: programmeData.code,
            name: programmeData.name,
            totalAcademicPeriods: programmeData.total_academic_periods,
            maximumCohortSize: programmeData.maximum_cohort_size,
            isActive: programmeData.is_active,
            isTimetableAvailable: programmeData.is_timetable_available,
          }
        : null,
    };
  });

  // Apply in-memory search filter if specified
  if (search) {
    cohorts = cohorts.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(search);
      const codeMatch = c.code.toLowerCase().includes(search);
      const progCodeMatch = c.programme?.code.toLowerCase().includes(search);
      const progNameMatch = c.programme?.name.toLowerCase().includes(search);
      return nameMatch || codeMatch || progCodeMatch || progNameMatch;
    });
  }

  // Collect cohort IDs present in the export
  const exportedCohortIds = new Set(cohorts.map((c) => c.id));

  // Build enrolled students roster for the exported cohorts
  const exportedStudents: CohortExportStudent[] = [];
  for (const st of rawStudents) {
    if (st.current_cohort_id && exportedCohortIds.has(st.current_cohort_id)) {
      const cohort = relation(st.current_cohort);
      const programme = relation(st.programme);

      exportedStudents.push({
        admissionNumber: st.admission_number,
        fullName: st.full_name,
        cohortId: st.current_cohort_id,
        cohortCode: cohort?.code ?? '',
        cohortName: cohort?.name ?? '',
        programmeCode: programme?.code ?? '',
        programmeName: programme?.name ?? '',
        currentStage: formatStudentStage(cohort?.current_academic_period_number),
        lifecycleStatus: st.lifecycle_status,
        academicPhase: st.academic_phase,
        phoneNumber: st.phone_number,
        email: st.email,
        detailsVerifiedAt: st.details_verified_at,
      });
    }
  }

  // Find programme name if filtered by programme
  const matchedProgrammeName =
    programmeId && programmeId !== 'all'
      ? cohorts.find((c) => c.programmeId === programmeId)?.programme?.name
      : undefined;

  // Generate ExcelJS workbook
  const workbook = await generateCohortExportWorkbook({
    cohorts,
    students: exportedStudents,
    departmentName,
    filters: {
      programmeName: matchedProgrammeName,
      status: status !== 'all' ? status : undefined,
      availability: availability !== 'all' ? availability : undefined,
      search,
    },
  });

  const buffer = await workbook.xlsx.writeBuffer();

  // Determine dynamic filename
  let filename = 'department-cohorts.xlsx';
  if (cohortId && cohorts.length === 1) {
    const cleanCode = cohorts[0].code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    filename = `cohort-${cleanCode}.xlsx`;
  } else if (programmeId && programmeId !== 'all' && cohorts.length > 0 && cohorts[0].programme) {
    const cleanProg = cohorts[0].programme.code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    filename = `cohorts-${cleanProg}.xlsx`;
  } else if (status && status !== 'all') {
    filename = `cohorts-${status}.xlsx`;
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
