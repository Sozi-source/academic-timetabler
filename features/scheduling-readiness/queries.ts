import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { allocationMatchesOffering } from '@/features/teaching-allocations/allocation-reconciliation';

import { assessSchedulingReadiness } from './assessment';
import type {
  ReadinessOffering,
  ReadinessParticipant,
  SchedulingReadiness,
} from './types';

type Relation<T> = T | T[] | null;

interface OfferingRow {
  id: string;
  academic_period_id: string;
  title: string;
  shared_class_key: string | null;
  trainer_id: string | null;
  preferred_room_id: string | null;
  delivery_mode: string;
  weekly_sessions: number;
  session_duration_minutes: number;
  status: string;
  is_timetable_enabled: boolean;
  trainers: Relation<{
    id: string;
    staff_number: string;
    full_name: string;
    normal_weekly_hours: number | string;
    maximum_weekly_hours: number | string;
    is_active: boolean;
    is_timetable_available: boolean;
  }> | null;
  rooms: Relation<{
    id: string;
    code: string;
    name: string;
    room_type: string;
    capacity: number;
    is_active: boolean;
    is_timetable_available: boolean;
  }> | null;
  teaching_offering_participants: Array<{
    id: string;
    cohort_id: string;
      unit_id: string;
      unit_offering_id: string | null;
    unit_offerings: Relation<{
      approval_status: 'review_required' | 'approved' | 'withdrawn';
      selection_state: 'included' | 'excluded';
      is_timetable_enabled: boolean;
      confirmed_shared_offering_id: string | null;
    }>;
    cohorts: Relation<{
      id: string;
      code: string;
      name: string;
      actual_size: number;
      status: string;
      is_timetable_available: boolean;
    }> | null;
    units: Relation<{
      id: string;
      code: string;
      name: string;
      is_active: boolean;
      is_timetable_available: boolean;
    }> | null;
  }>;
}

function first<T>(value: T[] | T | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function mapParticipant(row: OfferingRow['teaching_offering_participants'][number]): ReadinessParticipant | null {
  const cohort = first(row.cohorts);
  const unit = first(row.units);
  if (!cohort || !unit) return null;

  return {
    id: row.id,
    cohortId: cohort.id,
    cohortCode: cohort.code,
    cohortName: cohort.name,
    cohortSize: cohort.actual_size,
    cohortStatus: cohort.status,
    cohortTimetableAvailable: cohort.is_timetable_available,
    unitId: unit.id,
    unitCode: unit.code,
    unitName: unit.name,
    unitActive: unit.is_active,
    unitTimetableAvailable: unit.is_timetable_available,
  };
}

interface AllocationContextRow {
  cohort_id: string;
  unit_id: string;
  teaching_offering_id: string | null;
  source_unit_offering_id: string | null;
  participant_cohort_ids: string[] | null;
  trainer_id: string | null;
  preferred_room_id: string | null;
  delivery_mode: string;
  weekly_sessions: number;
  session_duration_minutes: number;
  status: string;
  is_timetable_enabled: boolean;
  trainers: Relation<{
    id: string;
    staff_number: string;
    full_name: string;
    normal_weekly_hours: number | string;
    maximum_weekly_hours: number | string;
    is_active: boolean;
    is_timetable_available: boolean;
  }>;
  rooms: Relation<{
    id: string;
    code: string;
    name: string;
    room_type: string;
    capacity: number;
    is_active: boolean;
    is_timetable_available: boolean;
  }>;
  units: Relation<{
    name: string;
  }>;
}

function mapOffering(
  row: OfferingRow,
  allocations: AllocationContextRow[],
): ReadinessOffering {
  const participants = row.teaching_offering_participants
    .map(mapParticipant)
    .filter((participant): participant is ReadinessParticipant => participant !== null);
  const matchingAllocations = allocations.filter((allocation) =>
    allocationMatchesOffering({
      teachingOfferingId: row.id,
      participants: participants.map((participant) => ({
        cohortId: participant.cohortId,
        unitId: participant.unitId,
        unitOfferingId: row.teaching_offering_participants.find(
          (item) => item.id === participant.id,
        )?.unit_offering_id ?? null,
      })),
      title: row.title,
      sessionDurationMinutes: row.session_duration_minutes,
    }, {
      teachingOfferingId: allocation.teaching_offering_id,
      sourceUnitOfferingId: allocation.source_unit_offering_id,
      cohortId: allocation.cohort_id,
      unitId: allocation.unit_id,
      participantCohortIds: allocation.participant_cohort_ids ?? [allocation.cohort_id],
      unitTitle: first(allocation.units)?.name ?? null,
      sessionDurationMinutes: allocation.session_duration_minutes,
    }),
  );
  const allocation = matchingAllocations.find((item) => item.teaching_offering_id === row.id)
    ?? matchingAllocations.find((item) => item.trainer_id !== null)
    ?? matchingAllocations[0]
    ?? null;
  const trainer = allocation ? first(allocation.trainers) : first(row.trainers);
  const room = allocation ? first(allocation.rooms) : first(row.rooms);
  // Once an allocation-register record exists it is authoritative, including
  // an intentional null trainer/room on a trainer-pending draft allocation.
  const trainerId = allocation ? allocation.trainer_id : row.trainer_id;
  const preferredRoomId = allocation
    ? allocation.preferred_room_id
    : row.preferred_room_id;
  const isProvisionalReservation = Boolean(allocation && !allocation.trainer_id);

  return {
    id: row.id,
    academicPeriodId: row.academic_period_id,
    title: row.title,
    sharedClassKey: row.shared_class_key,
    trainerId,
    trainerName: trainer?.full_name ?? null,
    trainerStaffNumber: trainer?.staff_number ?? null,
    trainerActive: trainer?.is_active ?? null,
    trainerTimetableAvailable: trainer?.is_timetable_available ?? null,
    trainerMaximumWeeklyHours: trainer ? Number(trainer.normal_weekly_hours) : null,
    preferredRoomId,
    preferredRoomName: room?.name ?? null,
    preferredRoomCode: room?.code ?? null,
    preferredRoomType: room?.room_type ?? null,
    preferredRoomCapacity: room?.capacity ?? null,
    preferredRoomActive: room?.is_active ?? null,
    preferredRoomTimetableAvailable: room?.is_timetable_available ?? null,
    deliveryMode: allocation?.delivery_mode ?? row.delivery_mode,
    weeklySessions: allocation?.weekly_sessions ?? row.weekly_sessions,
    sessionDurationMinutes: allocation?.session_duration_minutes ?? row.session_duration_minutes,
    status: allocation?.status ?? row.status,
    isTimetableEnabled: allocation?.is_timetable_enabled ?? row.is_timetable_enabled,
    isProvisionalReservation,
    participants,
  };
}

export const getSchedulingReadiness = cache(async (
  academicPeriodId: string,
): Promise<SchedulingReadiness | null> => {
  const supabase = await createClient();

  const [periodResult, offeringsResult, daysResult, slotsResult, trainersResult, roomsResult, allocationsResult] = await Promise.all([
    supabase.from('academic_periods').select('id, code, name, status').eq('id', academicPeriodId).maybeSingle(),
    supabase.from('teaching_offerings').select(`
      id,
      academic_period_id,
      title,
      shared_class_key,
      trainer_id,
      preferred_room_id,
      delivery_mode,
      weekly_sessions,
      session_duration_minutes,
      status,
      is_timetable_enabled,
      trainers (id, staff_number, full_name, normal_weekly_hours, maximum_weekly_hours, is_active, is_timetable_available),
      rooms (id, code, name, room_type, capacity, is_active, is_timetable_available),
      teaching_offering_participants (
        id,
        cohort_id,
        unit_id,
        unit_offering_id,
        unit_offerings (approval_status, selection_state, is_timetable_enabled, confirmed_shared_offering_id),
        cohorts (id, code, name, actual_size, status, is_timetable_available),
        units (id, code, name, is_active, is_timetable_available)
      )
    `).eq('academic_period_id', academicPeriodId).order('title'),
    supabase.from('working_days').select('id', { count: 'exact', head: true }).eq('academic_period_id', academicPeriodId).eq('is_enabled', true),
    supabase.from('time_slots').select('id', { count: 'exact', head: true }).eq('academic_period_id', academicPeriodId).eq('is_enabled', true).eq('slot_type', 'teaching'),
    supabase.from('trainers').select('id, staff_number, full_name, normal_weekly_hours').eq('is_active', true).eq('is_timetable_available', true).order('full_name'),
    supabase.from('rooms').select('id, code, name, room_type, capacity').eq('is_active', true).eq('is_timetable_available', true).order('capacity').order('code'),
    supabase.from('teaching_allocations').select(`
      cohort_id,
      unit_id,
      teaching_offering_id,
      source_unit_offering_id,
      participant_cohort_ids,
      trainer_id,
      preferred_room_id,
      delivery_mode,
      weekly_sessions,
      session_duration_minutes,
      status,
      is_timetable_enabled,
      trainers (id, staff_number, full_name, normal_weekly_hours, maximum_weekly_hours, is_active, is_timetable_available),
      rooms (id, code, name, room_type, capacity, is_active, is_timetable_available)
      ,
      units (name)
      ,
      source_unit_offering:unit_offerings!teaching_allocations_source_unit_offering_id_fkey!inner (
        approval_status, selection_state, is_timetable_enabled
      )
    `).eq('academic_period_id', academicPeriodId).eq('is_timetable_enabled', true).in('status', ['draft', 'active'])
      .eq('source_unit_offering.approval_status', 'approved')
      .eq('source_unit_offering.selection_state', 'included')
      .eq('source_unit_offering.is_timetable_enabled', true),
  ]);

  const firstError = periodResult.error ?? offeringsResult.error ?? daysResult.error ?? slotsResult.error ?? trainersResult.error ?? roomsResult.error ?? allocationsResult.error;
  if (firstError) {
    throw new Error(`Unable to assess timetable readiness: ${firstError.message}`);
  }

  if (!periodResult.data) return null;

  const allocations = (allocationsResult.data ?? []) as unknown as AllocationContextRow[];
  const offerings = ((offeringsResult.data ?? []) as unknown as OfferingRow[])
    .filter((offering) => offering.teaching_offering_participants.length > 0
      && offering.teaching_offering_participants.every((participant) => {
        const source = first(participant.unit_offerings);
        return source?.approval_status === 'approved'
          && source.selection_state === 'included'
          && source.is_timetable_enabled
          && (!source.confirmed_shared_offering_id
            || source.confirmed_shared_offering_id === offering.id);
      }))
    .map((offering) => mapOffering(offering, allocations));
  const assessment = assessSchedulingReadiness({
    academicPeriodStatus: periodResult.data.status,
    offerings,
    workingDayCount: daysResult.count ?? 0,
    teachingSlotCount: slotsResult.count ?? 0,
    availableTrainerCount: trainersResult.data?.length ?? 0,
    availableRoomCount: roomsResult.data?.length ?? 0,
  });

  const enabled = offerings.filter((offering) => offering.isTimetableEnabled);
  const requestedMinutes = enabled.reduce((total, offering) => total + offering.weeklySessions * offering.sessionDurationMinutes, 0);

  return {
    academicPeriodId,
    academicPeriodName: periodResult.data.name,
    academicPeriodCode: periodResult.data.code,
    academicPeriodStatus: periodResult.data.status,
    score: assessment.score,
    isReady: assessment.isReady,
    blockerCount: assessment.blockerCount,
    warningCount: assessment.warningCount,
    offeringCount: offerings.length,
    enabledOfferingCount: enabled.length,
    sharedOfferingCount: enabled.filter((offering) => offering.participants.length > 1 || offering.sharedClassKey).length,
    participantCount: enabled.reduce((total, offering) => total + offering.participants.length, 0),
    assignedTrainerCount: enabled.filter((offering) => offering.trainerId).length,
    preferredRoomCount: enabled.filter((offering) => offering.preferredRoomId).length,
    workingDayCount: daysResult.count ?? 0,
    teachingSlotCount: slotsResult.count ?? 0,
    availableTrainerCount: trainersResult.data?.length ?? 0,
    availableRoomCount: roomsResult.data?.length ?? 0,
    requestedWeeklySessions: enabled.reduce((total, offering) => total + offering.weeklySessions, 0),
    requestedWeeklyHours: Number((requestedMinutes / 60).toFixed(1)),
    issues: assessment.issues,
    offerings,
    trainerWorkloads: assessment.workloads,
    trainerOptions: (trainersResult.data ?? []).map((trainer) => ({
      id: trainer.id,
      label: trainer.full_name,
      maximumWeeklyHours: Number(trainer.normal_weekly_hours),
    })),
    roomOptions: (roomsResult.data ?? []).map((room) => ({
      id: room.id,
      label: room.code,
      roomType: room.room_type,
      capacity: room.capacity,
    })),
  };
});
