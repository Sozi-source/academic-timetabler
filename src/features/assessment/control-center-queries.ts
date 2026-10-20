import 'server-only';

import { cache } from 'react';
import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export interface AssessmentControlCenterItem {
  id: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  academicPeriodId: string;
  academicPeriodName: string;
  trainerNames: string[];
  populationCount: number;
  populationLocked: boolean;
  populationLockedAt: string | null;
  marksSource: 'excel' | 'online' | 'mixed' | 'pending';
  totalExpected: number;
  satCount: number;
  absentCount: number;
  missingCount: number;
  workflowStatus: string;
  isSubmitted: boolean;
  submittedAt: string | null;
  isFinalised: boolean;
  finalisedAt: string | null;
  isPublished: boolean;
  publishedAt: string | null;
}

export interface AssessmentControlCenterSummary {
  totalMarkbooks: number;
  totalPopulation: number;
  rosterLockedCount: number;
  rosterUnlockedCount: number;
  submittedCount: number;
  finalisedCount: number;
  publishedCount: number;
  excelSourceCount: number;
  onlineSourceCount: number;
  totalMissingMarks: number;
}

export interface AssessmentControlCenterData {
  periods: Array<{ id: string; code: string; name: string; status: string }>;
  selectedPeriodId: string;
  selectedPeriodName: string;
  departmentName: string;
  summary: AssessmentControlCenterSummary;
  items: AssessmentControlCenterItem[];
}

export const getAssessmentControlCenterData = cache(
  async (targetPeriodId?: string): Promise<AssessmentControlCenterData> => {
    const profile = await requireHodAccess();
    if (!profile.activeDepartmentId) {
      return {
        periods: [],
        selectedPeriodId: '',
        selectedPeriodName: '',
        departmentName: '',
        summary: {
          totalMarkbooks: 0,
          totalPopulation: 0,
          rosterLockedCount: 0,
          rosterUnlockedCount: 0,
          submittedCount: 0,
          finalisedCount: 0,
          publishedCount: 0,
          excelSourceCount: 0,
          onlineSourceCount: 0,
          totalMissingMarks: 0,
        },
        items: [],
      };
    }

    const admin = createAdminClient();

    // 1. Load academic periods
    const { data: periodRows, error: periodError } = await admin
      .from('academic_periods')
      .select('id, code, name, status, starts_on')
      .order('starts_on', { ascending: false });

    if (periodError) {
      throw new Error(`Unable to load academic periods: ${periodError.message}`);
    }

    const periods = (periodRows ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status,
    }));

    const activePeriod =
      (targetPeriodId ? periods.find((p) => p.id === targetPeriodId) : null) ??
      periods.find((p) => p.status === 'active') ??
      periods[0] ??
      null;

    if (!activePeriod) {
      return {
        periods,
        selectedPeriodId: '',
        selectedPeriodName: 'No period selected',
        departmentName: profile.departmentName ?? 'Department',
        summary: {
          totalMarkbooks: 0,
          totalPopulation: 0,
          rosterLockedCount: 0,
          rosterUnlockedCount: 0,
          submittedCount: 0,
          finalisedCount: 0,
          publishedCount: 0,
          excelSourceCount: 0,
          onlineSourceCount: 0,
          totalMissingMarks: 0,
        },
        items: [],
      };
    }

    // 2. Fetch assessment events for the department and academic period
    const { data: events, error: eventsError } = await admin
      .from('assessment_events')
      .select(`
        id,
        title,
        unit_id,
        academic_period_id,
        status,
        operational_assessment_type,
        operational_workflow_status,
        population_locked_at,
        marks_submitted_at,
        finalised_at,
        published_at,
        attendance_finalized_at,
        cat_marks_finalized_at,
        exam_marks_finalized_at,
        unit:units(id, code, name),
        academic_period:academic_periods(id, code, name)
      `)
      .eq('department_id', profile.activeDepartmentId)
      .eq('academic_period_id', activePeriod.id)
      .eq('title', 'Unit Markbook')
      .order('created_at', { ascending: false });

    if (eventsError) {
      throw new Error(`Unable to load assessment events: ${eventsError.message}`);
    }

    const eventRows = events ?? [];
    if (eventRows.length === 0) {
      return {
        periods,
        selectedPeriodId: activePeriod.id,
        selectedPeriodName: activePeriod.name,
        departmentName: profile.departmentName ?? 'Department',
        summary: {
          totalMarkbooks: 0,
          totalPopulation: 0,
          rosterLockedCount: 0,
          rosterUnlockedCount: 0,
          submittedCount: 0,
          finalisedCount: 0,
          publishedCount: 0,
          excelSourceCount: 0,
          onlineSourceCount: 0,
          totalMissingMarks: 0,
        },
        items: [],
      };
    }

    const eventIds = eventRows.map((e) => e.id);
    const unitIds = [...new Set(eventRows.map((e) => e.unit_id).filter(Boolean))];

    // 3. Use current unit registrations as the candidate source; assessment populations are snapshots
    // and can drift after a student's unit registration is corrected.
    const fetchCurrentRegistrations = async () => {
      const pageSize = 1000;
      const rows: Array<{ unit_id: string; student_id: string }> = [];
      let offset = 0;

      while (true) {
        const { data, error } = await admin
          .from('student_unit_registrations')
          .select('unit_id,student_id')
          .eq('academic_period_id', activePeriod.id)
          .eq('registration_status', 'registered')
          .in('unit_id', unitIds)
          .order('unit_id', { ascending: true })
          .order('student_id', { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) throw new Error(`Unable to load current unit registrations: ${error.message}`);
        if (!data?.length) break;
        rows.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      return rows;
    };

    const [
      { data: populations, error: popError },
      registrations,
      { data: results, error: resError },
      { data: onlineDrafts, error: draftsError },
      { data: allocations, error: allocError },
    ] = await Promise.all([
      admin
        .from('assessment_population')
        .select('assessment_event_id, student_id, attendance_status')
        .in('assessment_event_id', eventIds),
      fetchCurrentRegistrations(),
      admin
        .from('assessment_results')
        .select('assessment_event_id, student_id, import_source, operational_result_status, component_marks, total_mark')
        .in('assessment_event_id', eventIds),
      admin
        .from('assessment_online_mark_drafts')
        .select('assessment_id, student_id, assignment_mark, presentation_mark, rat_mark, cat_mark, exam_mark')
        .in('assessment_id', eventIds),
      admin
        .from('teaching_allocations')
        .select('unit_id, cohort_id, participant_cohort_ids, trainer:trainers(id, full_name)')
        .eq('academic_period_id', activePeriod.id)
        .in('unit_id', unitIds)
        .in('status', ['draft', 'active']),
    ]);

    if (popError) throw new Error(`Unable to load assessment populations: ${popError.message}`);
    if (resError) throw new Error(`Unable to load assessment results: ${resError.message}`);
    if (draftsError) throw new Error(`Unable to load online marks drafts: ${draftsError.message}`);
    if (allocError) throw new Error(`Unable to load teaching allocations: ${allocError.message}`);

    // Map teaching allocations -> trainers per unit
    const unitTrainersMap = new Map<string, Set<string>>();
    for (const alloc of allocations ?? []) {
      const trainer = one(alloc.trainer as Relation<{ id: string; full_name: string }>);
      if (trainer?.full_name && alloc.unit_id) {
        if (!unitTrainersMap.has(alloc.unit_id)) {
          unitTrainersMap.set(alloc.unit_id, new Set());
        }
        unitTrainersMap.get(alloc.unit_id)!.add(trainer.full_name.trim());
      }
    }

    // Map populations per event
    const eventPopulationsMap = new Map<string, typeof populations>();
    for (const pop of populations ?? []) {
      if (!eventPopulationsMap.has(pop.assessment_event_id)) {
        eventPopulationsMap.set(pop.assessment_event_id, []);
      }
      eventPopulationsMap.get(pop.assessment_event_id)!.push(pop);
    }

    const registrationsByUnitMap = new Map<string, typeof registrations>();
    for (const registration of registrations ?? []) {
      if (!registrationsByUnitMap.has(registration.unit_id)) {
        registrationsByUnitMap.set(registration.unit_id, []);
      }
      registrationsByUnitMap.get(registration.unit_id)!.push(registration);
    }

    // Map results per event
    const eventResultsMap = new Map<string, typeof results>();
    for (const res of results ?? []) {
      if (!eventResultsMap.has(res.assessment_event_id)) {
        eventResultsMap.set(res.assessment_event_id, []);
      }
      eventResultsMap.get(res.assessment_event_id)!.push(res);
    }

    // Map online drafts per event
    const eventDraftsMap = new Map<string, typeof onlineDrafts>();
    for (const draft of onlineDrafts ?? []) {
      if (!eventDraftsMap.has(draft.assessment_id)) {
        eventDraftsMap.set(draft.assessment_id, []);
      }
      eventDraftsMap.get(draft.assessment_id)!.push(draft);
    }

    // Build items
    const items: AssessmentControlCenterItem[] = [];

    for (const event of eventRows) {
      const unit = one(event.unit as Relation<{ id: string; code: string; name: string }>);
      const period = one(event.academic_period as Relation<{ id: string; code: string; name: string }>);
      const evPops = eventPopulationsMap.get(event.id) ?? [];
      const currentRegistrations = registrationsByUnitMap.get(event.unit_id) ?? [];
      const evResults = eventResultsMap.get(event.id) ?? [];
      const evDrafts = eventDraftsMap.get(event.id) ?? [];

      const totalExpected = currentRegistrations.length;
      const trainerNames = Array.from(unitTrainersMap.get(event.unit_id) ?? []);

      // Determine marks source
      const sources = new Set(evResults.map((r) => r.import_source).filter(Boolean));
      let marksSource: 'excel' | 'online' | 'mixed' | 'pending' = 'pending';
      if (sources.has('excel') && sources.has('online')) {
        marksSource = 'mixed';
      } else if (sources.has('excel')) {
        marksSource = 'excel';
      } else if (sources.has('online')) {
        marksSource = 'online';
      } else if (evDrafts.length > 0) {
        marksSource = 'online';
      }

      // Count sat, absent, and missing marks
      const resultMapByStudent = new Map(evResults.map((r) => [r.student_id, r]));
      const draftMapByStudent = new Map(evDrafts.map((draft) => [draft.student_id, draft]));
      let satCount = 0;
      let absentCount = 0;
      let missingCount = 0;

      const attendanceByStudent = new Map(evPops.map((population) => [population.student_id, population.attendance_status]));
      for (const registration of currentRegistrations) {
        const res = resultMapByStudent.get(registration.student_id);
        const draft = draftMapByStudent.get(registration.student_id);
        if (attendanceByStudent.get(registration.student_id) === 'absent' || res?.operational_result_status === 'absent') {
          absentCount += 1;
        } else if (
          res &&
          (res.operational_result_status === 'sat' ||
            (res.total_mark !== null && res.total_mark !== undefined))
        ) {
          satCount += 1;
        } else if (
          draft && [draft.assignment_mark, draft.presentation_mark, draft.rat_mark, draft.cat_mark, draft.exam_mark].some((mark) => mark !== null)
        ) {
          satCount += 1;
        } else {
          missingCount += 1;
        }
      }

      const isLocked = Boolean(
        event.population_locked_at ||
          event.cat_marks_finalized_at ||
          event.exam_marks_finalized_at ||
          event.marks_submitted_at ||
          event.finalised_at ||
          event.status === 'submitted' ||
          event.status === 'closed'
      );

      const isSubmitted = Boolean(
        event.marks_submitted_at ||
          event.operational_workflow_status === 'submitted' ||
          event.status === 'submitted'
      );

      const isFinalised = Boolean(
        event.finalised_at ||
          event.exam_marks_finalized_at ||
          event.operational_workflow_status === 'finalised'
      );

      const isPublished = Boolean(
        event.published_at || (isFinalised && event.published_at !== null)
      );

      items.push({
        id: event.id,
        unitId: event.unit_id,
        unitCode: unit?.code ?? 'Unit',
        unitName: unit?.name ?? 'Unit markbook',
        academicPeriodId: activePeriod.id,
        academicPeriodName: period?.name ?? activePeriod.name,
        trainerNames,
        populationCount: totalExpected,
        populationLocked: isLocked,
        populationLockedAt: event.population_locked_at,
        marksSource,
        totalExpected,
        satCount,
        absentCount,
        missingCount,
        workflowStatus: isFinalised ? 'finalised' : isSubmitted ? 'submitted' : event.status ?? 'draft',
        isSubmitted,
        submittedAt: event.marks_submitted_at,
        isFinalised,
        finalisedAt: event.finalised_at ?? event.exam_marks_finalized_at,
        isPublished,
        publishedAt: event.published_at,
      });
    }

    // Build overall summaries
    const summary: AssessmentControlCenterSummary = {
      totalMarkbooks: items.length,
      totalPopulation: items.reduce((acc, item) => acc + item.totalExpected, 0),
      rosterLockedCount: items.filter((item) => item.populationLocked).length,
      rosterUnlockedCount: items.filter((item) => !item.populationLocked).length,
      submittedCount: items.filter((item) => item.isSubmitted).length,
      finalisedCount: items.filter((item) => item.isFinalised).length,
      publishedCount: items.filter((item) => item.isPublished).length,
      excelSourceCount: items.filter((item) => item.marksSource === 'excel').length,
      onlineSourceCount: items.filter((item) => item.marksSource === 'online').length,
      totalMissingMarks: items.reduce((acc, item) => acc + item.missingCount, 0),
    };

    return {
      periods,
      selectedPeriodId: activePeriod.id,
      selectedPeriodName: activePeriod.name,
      departmentName: profile.departmentName ?? 'Department',
      summary,
      items,
    };
  }
);
