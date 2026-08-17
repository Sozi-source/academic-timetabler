import { cache } from 'react';

import { requireTrainerAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

import type {
  TrainerAttendanceUnit,
  TrainerAttendanceWorkspace,
} from './types';

async function getCurrentTrainer() {
  const profile = await requireTrainerAccess();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('trainers')
    .select('id,full_name,is_active')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle<{ id: string; full_name: string; is_active: boolean }>();

  if (error) throw new Error(`Unable to load trainer profile: ${error.message}`);
  if (!data) throw new Error('Your account is not linked to an active trainer record.');

  return data;
}

export const getTrainerAttendanceUnits = cache(
  async (): Promise<TrainerAttendanceUnit[]> => {
    const trainer = await getCurrentTrainer();
    const admin = createAdminClient();

    const { data: allocations, error: allocationError } = await admin
      .from('teaching_allocations')
      .select('academic_period_id,unit_id')
      .eq('trainer_id', trainer.id)
      .in('status', ['draft', 'active']);

    if (allocationError) {
      throw new Error(`Unable to load trainer units: ${allocationError.message}`);
    }

    if (!allocations?.length) return [];

    const periodIds = [...new Set(allocations.map((row) => row.academic_period_id))];
    const unitIds = [...new Set(allocations.map((row) => row.unit_id))];

    const { data: events, error: eventError } = await admin
      .from('assessment_events')
      .select(`
        id,
        academic_period_id,
        unit_id,
        attendance_finalized_at,
        exam_marks_finalized_at,
        academic_period:academic_periods(name),
        unit:units(code,name)
      `)
      .in('academic_period_id', periodIds)
      .in('unit_id', unitIds)
      .eq('assessment_type', 'unit_markbook');

    if (eventError) {
      throw new Error(`Unable to load Unit Markbooks: ${eventError.message}`);
    }

    const allocationKeys = new Set(
      allocations.map((row) => `${row.academic_period_id}:${row.unit_id}`),
    );

    const result: TrainerAttendanceUnit[] = [];

    for (const event of events ?? []) {
      if (!allocationKeys.has(`${event.academic_period_id}:${event.unit_id}`)) continue;

      const { count: expectedStudents } = await admin
        .from('assessment_population')
        .select('id', { count: 'exact', head: true })
        .eq('assessment_event_id', event.id)
        .eq('population_status', 'expected');

      const { count: absentStudents } = await admin
        .from('assessment_population')
        .select('id', { count: 'exact', head: true })
        .eq('assessment_event_id', event.id)
        .eq('population_status', 'expected')
        .eq('attendance_status', 'absent');

      const period = Array.isArray(event.academic_period)
        ? event.academic_period[0]
        : event.academic_period;
      const unit = Array.isArray(event.unit) ? event.unit[0] : event.unit;

      result.push({
        assessmentId: event.id,
        unitCode: unit?.code ?? 'UNIT',
        unitName: unit?.name ?? 'Unit',
        academicPeriodName: period?.name ?? 'Academic period',
        expectedStudents: expectedStudents ?? 0,
        absentStudents: absentStudents ?? 0,
        attendanceFinalizedAt: event.attendance_finalized_at,
        examMarksFinalizedAt: event.exam_marks_finalized_at,
      });
    }

    return result.sort((a, b) => a.unitName.localeCompare(b.unitName));
  },
);

export async function getTrainerAttendanceWorkspace(
  assessmentId: string,
): Promise<TrainerAttendanceWorkspace | null> {
  const trainer = await getCurrentTrainer();
  const admin = createAdminClient();

  const { data: event, error: eventError } = await admin
    .from('assessment_events')
    .select(`
      id,
      academic_period_id,
      unit_id,
      attendance_finalized_at,
      exam_marks_finalized_at,
      academic_period:academic_periods(name),
      unit:units(code,name)
    `)
    .eq('id', assessmentId)
    .eq('assessment_type', 'unit_markbook')
    .maybeSingle();

  if (eventError) throw new Error(`Unable to load Unit Markbook: ${eventError.message}`);
  if (!event) return null;

  const { data: allocation, error: allocationError } = await admin
    .from('teaching_allocations')
    .select('id')
    .eq('trainer_id', trainer.id)
    .eq('academic_period_id', event.academic_period_id)
    .eq('unit_id', event.unit_id)
    .in('status', ['draft', 'active'])
    .limit(1)
    .maybeSingle();

  if (allocationError) throw new Error(`Unable to verify trainer allocation: ${allocationError.message}`);
  if (!allocation) return null;

  const { data: population, error: populationError } = await admin
    .from('assessment_population')
    .select(`
      attendance_status,
      student:students(id,admission_number,full_name),
      cohort:cohorts(name)
    `)
    .eq('assessment_event_id', assessmentId)
    .eq('population_status', 'expected')
    .order('created_at', { ascending: true });

  if (populationError) {
    throw new Error(`Unable to load examination population: ${populationError.message}`);
  }

  const period = Array.isArray(event.academic_period)
    ? event.academic_period[0]
    : event.academic_period;
  const unit = Array.isArray(event.unit) ? event.unit[0] : event.unit;

  return {
    assessmentId: event.id,
    unitCode: unit?.code ?? 'UNIT',
    unitName: unit?.name ?? 'Unit',
    academicPeriodName: period?.name ?? 'Academic period',
    trainerName: trainer.full_name,
    attendanceFinalizedAt: event.attendance_finalized_at,
    examMarksFinalizedAt: event.exam_marks_finalized_at,
    students: (population ?? []).flatMap((row) => {
      const student = Array.isArray(row.student) ? row.student[0] : row.student;
      const cohort = Array.isArray(row.cohort) ? row.cohort[0] : row.cohort;
      if (!student) return [];

      return [{
        id: student.id,
        admissionNumber: student.admission_number,
        fullName: student.full_name,
        cohortName: cohort?.name ?? '—',
        isAbsent: row.attendance_status === 'absent',
      }];
    }).sort((a, b) =>
      `${a.cohortName}|${a.fullName}`.localeCompare(`${b.cohortName}|${b.fullName}`),
    ),
  };
}
