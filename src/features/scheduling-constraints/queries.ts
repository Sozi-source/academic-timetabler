import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { SchedulingConstraintData } from './types';

export const getSchedulingConstraintData = cache(async (academicPeriodId: string): Promise<SchedulingConstraintData> => {
  const supabase = await createClient();
  const [constraintResult, trainerResult, roomResult, cohortResult, dayResult] = await Promise.all([
    supabase.from('scheduling_constraints').select('*').eq('academic_period_id', academicPeriodId).order('created_at', { ascending: false }),
    supabase.from('trainers').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('rooms').select('id, code, name').eq('is_active', true).order('code'),
    supabase.from('cohorts').select('id, name').in('status', ['planned','active']).order('name'),
    supabase.from('working_days').select('id, day_of_week, sequence_number').eq('academic_period_id', academicPeriodId).eq('is_enabled', true).order('sequence_number'),
  ]);
  const failure = constraintResult.error ?? trainerResult.error ?? roomResult.error ?? cohortResult.error ?? dayResult.error;
  if (failure) throw new Error(`Unable to load scheduling constraints: ${failure.message}`);

  const trainers = (trainerResult.data ?? []).map((item) => ({ id: item.id, label: item.full_name }));
  const rooms = (roomResult.data ?? []).map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }));
  const cohorts = (cohortResult.data ?? []).map((item) => ({ id: item.id, label: item.name }));
  const workingDays = (dayResult.data ?? []).map((item) => ({ id: item.id, label: item.day_of_week.charAt(0).toUpperCase() + item.day_of_week.slice(1), sequenceNumber: item.sequence_number }));
  const labels = new Map<string,string>([...trainers, ...rooms, ...cohorts].map((item) => [item.id, item.label]));
  const dayLabels = new Map(workingDays.map((item) => [item.id, item.label]));

  return {
    trainers, rooms, cohorts, workingDays,
    constraints: (constraintResult.data ?? []).map((row) => ({
      id: row.id,
      academicPeriodId: row.academic_period_id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      subjectLabel: row.subject_type === 'institution' ? 'Institution-wide' : labels.get(row.subject_id ?? '') ?? 'Unknown record',
      constraintType: row.constraint_type,
      workingDayId: row.working_day_id,
      workingDayLabel: row.working_day_id ? dayLabels.get(row.working_day_id) ?? 'Unknown day' : null,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      priority: row.priority,
      reason: row.reason,
      isActive: row.is_active,
    })),
  };
});
