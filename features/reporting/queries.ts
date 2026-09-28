import 'server-only';

import { cache } from 'react';
import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  AttendanceReportItem,
  AssessmentCompletionReportItem,
  DepartmentExecutiveReportData,
  ExecutiveReportSummary,
  RegistrationCompletionReportItem,
  TeachingAllocationsReportItem,
  TeachingDocumentComplianceReportItem,
  TrainerWorkloadReportItem,
} from './types';

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export const getDepartmentExecutiveReport = cache(
  async (targetPeriodId?: string): Promise<DepartmentExecutiveReportData> => {
    const profile = await requireHodAccess();
    const admin = createAdminClient();

    const emptySummary: ExecutiveReportSummary = {
      trainerWorkload: {
        totalTrainers: 0,
        optimalCount: 0,
        underloadCount: 0,
        overloadCount: 0,
        totalWeeklyHours: 0,
        averageWeeklyHours: 0,
      },
      teachingAllocations: {
        totalOfferings: 0,
        allocatedCount: 0,
        unallocatedCount: 0,
        allocationRate: 0,
      },
      assessments: {
        totalMarkbooks: 0,
        rosterLockedCount: 0,
        finalisedCount: 0,
        publishedCount: 0,
        totalMissingMarks: 0,
        completionRate: 0,
      },
      registration: {
        totalCohorts: 0,
        eligibleStudents: 0,
        registeredStudents: 0,
        registrationRate: 0,
      },
      attendance: {
        totalSessions: 0,
        completedSessions: 0,
        sessionCompletionRate: 0,
        averageStudentAttendanceRate: 0,
      },
      documents: {
        totalRequired: 0,
        approvedCount: 0,
        submittedCount: 0,
        draftCount: 0,
        complianceRate: 0,
      },
    };

    if (!profile.activeDepartmentId) {
      return {
        periods: [],
        selectedPeriodId: '',
        selectedPeriodName: '',
        departmentName: '',
        generatedAt: new Date().toISOString(),
        summary: emptySummary,
        workload: [],
        allocations: [],
        assessments: [],
        registration: [],
        attendance: [],
        documents: [],
      };
    }

    // 1. Fetch academic periods
    const { data: periodRows, error: periodError } = await admin
      .from('academic_periods')
      .select('id, code, name, status, starts_on')
      .order('starts_on', { ascending: false });

    if (periodError) throw new Error(`Unable to load periods: ${periodError.message}`);

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
        selectedPeriodName: 'No period available',
        departmentName: profile.departmentName ?? 'Department',
        generatedAt: new Date().toISOString(),
        summary: emptySummary,
        workload: [],
        allocations: [],
        assessments: [],
        registration: [],
        attendance: [],
        documents: [],
      };
    }

    const periodId = activePeriod.id;
    const departmentId = profile.activeDepartmentId;

    // Concurrently fetch datasets across the department
    const [
      { data: trainersData },
      { data: allocationsData },
      { data: scheduledSessionsData },
      { data: assessmentEventsData },
      { data: cohortsData },
      { data: studentRegsData },
      { data: attendanceSessionsData },
      { data: teachingDocsData },
    ] = await Promise.all([
      // 1. Trainers
      admin
        .from('trainers')
        .select(`
          id,
          full_name,
          staff_role,
          target_weekly_hours,
          department_id,
          profile:profiles(full_name, role)
        `)
        .or(`department_id.eq.${departmentId},home_department_id.eq.${departmentId}`)
        .eq('is_active', true),

      // 2. Teaching Allocations
      admin
        .from('teaching_allocations')
        .select(`
          id,
          unit_id,
          cohort_id,
          participant_cohort_ids,
          academic_period_id,
          trainer_id,
          status,
          weekly_hours,
          is_cross_department,
          unit:units(id, code, name, weekly_session_count),
          cohort:cohorts(id, code, name),
          trainer:trainers(id, full_name)
        `)
        .eq('academic_period_id', periodId)
        .in('status', ['draft', 'active']),

      // 3. Timetable Scheduled Sessions
      admin
        .from('scheduled_sessions')
        .select(`
          id,
          teaching_allocation_id,
          trainer_id,
          duration_minutes,
          academic_period_id
        `)
        .eq('academic_period_id', periodId),

      // 4. Assessment Events & Results
      admin
        .from('assessment_events')
        .select(`
          id,
          unit_id,
          academic_period_id,
          title,
          status,
          population_locked_at,
          cat_marks_finalized_at,
          exam_marks_finalized_at,
          published_at,
          unit:units(id, code, name),
          population:assessment_population(id, student_id, population_status, attendance_status),
          results:assessment_results(id, student_id, import_source, operational_result_status, total_mark)
        `)
        .eq('department_id', departmentId)
        .eq('academic_period_id', periodId)
        .eq('title', 'Unit Markbook'),

      // 5. Cohorts & Student Registrations
      admin
        .from('cohorts')
        .select(`
          id,
          code,
          name,
          programme:programmes(id, name, code),
          stage:programme_stages(id, name, stage_number),
          students:students(id, lifecycle_status)
        `)
        .eq('department_id', departmentId)
        .in('status', ['active', 'planned']),

      // 6. Student Unit Registrations (paginated to avoid 1,000-row limit)
      (async () => {
        const PAGE_SIZE = 1000;
        const allRegistrations: Array<{ id: string; cohort_id: string | null; student_id: string; registration_status: string }> = [];
        let from = 0;
        while (true) {
          const { data, error } = await admin
            .from('student_unit_registrations')
            .select('id, cohort_id, student_id, registration_status')
            .eq('academic_period_id', periodId)
            .range(from, from + PAGE_SIZE - 1);
          if (error) return { data: null, error };
          if (!data || data.length === 0) break;
          allRegistrations.push(...data);
          if (data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
        return { data: allRegistrations, error: null };
      })(),

      // 7. Class Attendance Sessions
      admin
        .from('class_attendance_sessions')
        .select(`
          id,
          session_date,
          status,
          teaching_allocation_id,
          allocation:teaching_allocations(
            unit_id,
            trainer_id,
            unit:units(id, code, name),
            cohort:cohorts(name),
            trainer:trainers(full_name)
          ),
          records:class_attendance_records(id, attendance_status)
        `)
        .eq('academic_period_id', periodId),

      // 8. Teaching Documents
      admin
        .from('teaching_documents')
        .select(`
          id,
          allocation_id,
          unit_id,
          cohort_id,
          trainer_id,
          document_type,
          status
        `)
        .eq('academic_period_id', periodId),
    ]);

    // ==========================================
    // PILLAR 1: TRAINER WORKLOAD
    // ==========================================
    const trainerScheduledMinutes = new Map<string, number>();
    for (const sess of scheduledSessionsData ?? []) {
      if (sess.trainer_id) {
        trainerScheduledMinutes.set(
          sess.trainer_id,
          (trainerScheduledMinutes.get(sess.trainer_id) ?? 0) + (sess.duration_minutes ?? 120)
        );
      }
    }

    const trainerAllocationsMap = new Map<string, typeof allocationsData>();
    for (const alloc of allocationsData ?? []) {
      if (alloc.trainer_id) {
        if (!trainerAllocationsMap.has(alloc.trainer_id)) {
          trainerAllocationsMap.set(alloc.trainer_id, []);
        }
        trainerAllocationsMap.get(alloc.trainer_id)!.push(alloc);
      }
    }

    const workloadItems: TrainerWorkloadReportItem[] = (trainersData ?? []).map((t) => {
      const roleStr = t.staff_role ?? 'Trainer';
      let defaultTarget = 20;
      if (roleStr.toLowerCase().includes('hod') || roleStr.toLowerCase().includes('head')) {
        defaultTarget = 10;
      } else if (roleStr.toLowerCase().includes('coordinator')) {
        defaultTarget = 16;
      }
      const normalTargetHours = Number(t.target_weekly_hours) || defaultTarget;

      const allocs = trainerAllocationsMap.get(t.id) ?? [];
      const allocatedHours = allocs.reduce((sum, a) => sum + (Number(a.weekly_hours) || 4), 0);
      const scheduledMinutes = trainerScheduledMinutes.get(t.id) ?? 0;
      const scheduledHours = Math.round((scheduledMinutes / 60) * 10) / 10;

      const unitCodes = [
        ...new Set(allocs.map((a) => one(a.unit as Relation<{ code: string }>)?.code).filter(Boolean)),
      ] as string[];

      let workloadStatus: 'optimal' | 'underload' | 'overload' = 'optimal';
      if (allocatedHours > normalTargetHours + 2) {
        workloadStatus = 'overload';
      } else if (allocatedHours < normalTargetHours - 2 && allocatedHours > 0) {
        workloadStatus = 'underload';
      }

      return {
        trainerId: t.id,
        trainerName: t.full_name,
        role: roleStr,
        normalTargetHours,
        allocatedHours,
        scheduledHours,
        allocatedUnitsCount: unitCodes.length,
        workloadStatus,
        allocatedUnitCodes: unitCodes,
      };
    });

    // ==========================================
    // PILLAR 2: TEACHING ALLOCATIONS
    // ==========================================
    const allocationItems: TeachingAllocationsReportItem[] = (allocationsData ?? []).map((alloc) => {
      const unit = one(alloc.unit as Relation<{ id: string; code: string; name: string }>);
      const cohort = one(alloc.cohort as Relation<{ id: string; code: string; name: string }>);
      const trainer = one(alloc.trainer as Relation<{ id: string; full_name: string }>);

      return {
        id: alloc.id,
        unitId: alloc.unit_id,
        unitCode: unit?.code ?? 'Unit',
        unitName: unit?.name ?? 'Unit Name',
        cohortId: alloc.cohort_id,
        cohortName: cohort?.name ?? 'Cohort',
        trainerId: alloc.trainer_id,
        trainerName: trainer?.full_name ?? null,
        weeklyHours: Number(alloc.weekly_hours) || 4,
        status: alloc.trainer_id ? 'allocated' : 'unallocated',
        isCrossDepartment: Boolean(alloc.is_cross_department),
        participantCohortNames: [],
      };
    });

    // ==========================================
    // PILLAR 3: ASSESSMENT COMPLETION
    // ==========================================
    const assessmentItems: AssessmentCompletionReportItem[] = (assessmentEventsData ?? []).map((ev) => {
      const unit = one(ev.unit as Relation<{ id: string; code: string; name: string }>);
      const popRows = ((ev.population as Array<{ student_id: string; population_status?: string; attendance_status?: string }>) ?? []).filter((p) => p.population_status === 'expected');
      const resRows = (ev.results as Array<{ student_id: string; import_source?: string; operational_result_status?: string; total_mark?: number | null }>) ?? [];

      const totalPop = popRows.length;
      const resultMap = new Map(resRows.map((r) => [r.student_id, r]));

      let satCount = 0;
      let absentCount = 0;
      let missingCount = 0;

      for (const p of popRows) {
        const res = resultMap.get(p.student_id);
        if (p.attendance_status === 'absent' || res?.operational_result_status === 'absent') {
          absentCount += 1;
        } else if (res && (res.operational_result_status === 'sat' || res.total_mark !== null)) {
          satCount += 1;
        } else {
          missingCount += 1;
        }
      }

      const sources = new Set(resRows.map((r) => r.import_source).filter(Boolean));
      let marksSource: 'excel' | 'online' | 'mixed' | 'pending' = 'pending';
      if (sources.has('excel') && sources.has('online')) marksSource = 'mixed';
      else if (sources.has('excel')) marksSource = 'excel';
      else if (sources.has('online')) marksSource = 'online';

      const accounted = satCount + absentCount;
      const completionRate = totalPop > 0 ? Math.round((accounted / totalPop) * 100) : 0;

      return {
        id: ev.id,
        unitId: ev.unit_id,
        unitCode: unit?.code ?? 'Unit',
        unitName: unit?.name ?? 'Unit markbook',
        populationCount: totalPop,
        isPopulationLocked: Boolean(ev.population_locked_at),
        isCatFinalized: Boolean(ev.cat_marks_finalized_at),
        isExamFinalized: Boolean(ev.exam_marks_finalized_at),
        isPublished: Boolean(ev.published_at),
        marksSource,
        missingMarksCount: missingCount,
        satCount,
        absentCount,
        completionRate,
      };
    });

    // ==========================================
    // PILLAR 4: REGISTRATION COMPLETION
    // ==========================================
    const regsByCohort = new Map<string, typeof studentRegsData>();
    for (const reg of studentRegsData ?? []) {
      if (!regsByCohort.has(reg.cohort_id)) {
        regsByCohort.set(reg.cohort_id, []);
      }
      regsByCohort.get(reg.cohort_id)!.push(reg);
    }

    const registrationItems: RegistrationCompletionReportItem[] = (cohortsData ?? []).map((c) => {
      const prog = one(c.programme as Relation<{ id: string; name: string; code: string }>);
      const stage = one(c.stage as Relation<{ id: string; name: string }>);
      const activeStudents = (c.students ?? []).filter((s: { lifecycle_status: string }) => s.lifecycle_status === 'active');

      const regs = regsByCohort.get(c.id) ?? [];
      const distinctStudents = new Set(regs.map((r) => r.student_id));
      const confirmedRegs = regs.filter((r) => r.registration_status === 'confirmed');
      const confirmedStudents = new Set(confirmedRegs.map((r) => r.student_id));

      const eligibleCount = activeStudents.length || distinctStudents.size;
      const registeredCount = distinctStudents.size;
      const rate = eligibleCount > 0 ? Math.round((registeredCount / eligibleCount) * 100) : 0;

      return {
        cohortId: c.id,
        cohortCode: c.code,
        cohortName: c.name,
        programmeName: prog?.name ?? 'Programme',
        stageName: stage?.name ?? 'Current Stage',
        eligibleStudentCount: eligibleCount,
        preRegisteredCount: registeredCount - confirmedStudents.size,
        confirmedCount: confirmedStudents.size,
        totalRegisteredCount: registeredCount,
        registrationRate: rate,
        expectedUnitsCount: 0,
      };
    });

    // ==========================================
    // PILLAR 5: ATTENDANCE
    // ==========================================
    const attendanceByUnitCohort = new Map<string, typeof attendanceSessionsData>();
    for (const sess of attendanceSessionsData ?? []) {
      const alloc = one(sess.allocation as Relation<{ unit_id: string; cohort: Relation<{ name: string }> }>);
      if (alloc?.unit_id) {
        const key = `${alloc.unit_id}:${one(alloc.cohort)?.name ?? ''}`;
        if (!attendanceByUnitCohort.has(key)) {
          attendanceByUnitCohort.set(key, []);
        }
        attendanceByUnitCohort.get(key)!.push(sess);
      }
    }

    const attendanceItems: AttendanceReportItem[] = Array.from(attendanceByUnitCohort.entries()).map(([_, sessions]) => {
      const firstSess = sessions[0];
      const alloc = one(firstSess.allocation as Relation<{
        unit_id: string;
        unit: Relation<{ code: string; name: string }>;
        cohort: Relation<{ name: string }>;
        trainer: Relation<{ full_name: string }>;
      }>);

      const unit = one(alloc?.unit);
      const cohort = one(alloc?.cohort);
      const trainer = one(alloc?.trainer);

      const totalSessions = sessions.length;
      const completedSessions = sessions.filter((s) => s.status === 'completed').length;
      const openSessions = totalSessions - completedSessions;

      let presentCount = 0;
      let absentCount = 0;
      for (const s of sessions) {
        for (const r of s.records ?? []) {
          if (r.attendance_status === 'present') presentCount += 1;
          else if (r.attendance_status === 'absent') absentCount += 1;
        }
      }

      const totalMarked = presentCount + absentCount;
      const avgRate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;
      const compRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

      return {
        unitId: alloc?.unit_id ?? '',
        unitCode: unit?.code ?? 'Unit',
        unitName: unit?.name ?? 'Unit Name',
        cohortName: cohort?.name ?? 'Cohort',
        trainerName: trainer?.full_name ?? 'Trainer',
        totalSessionsScheduled: totalSessions,
        completedSessions,
        openSessions,
        completionRate: compRate,
        totalPresentCount: presentCount,
        totalAbsentCount: absentCount,
        averageAttendanceRate: avgRate,
      };
    });

    // ==========================================
    // PILLAR 6: TEACHING DOCUMENT COMPLIANCE
    // ==========================================
    const docsByAlloc = new Map<string, typeof teachingDocsData>();
    for (const doc of teachingDocsData ?? []) {
      if (!docsByAlloc.has(doc.allocation_id)) {
        docsByAlloc.set(doc.allocation_id, []);
      }
      docsByAlloc.get(doc.allocation_id)!.push(doc);
    }

    const documentItems: TeachingDocumentComplianceReportItem[] = (allocationsData ?? []).map((alloc) => {
      const unit = one(alloc.unit as Relation<{ code: string; name: string }>);
      const cohort = one(alloc.cohort as Relation<{ name: string }>);
      const trainer = one(alloc.trainer as Relation<{ full_name: string }>);

      const docs = docsByAlloc.get(alloc.id) ?? [];
      const getDocStatus = (type: string): 'draft' | 'submitted' | 'approved' | 'not_started' => {
        const found = docs.find((d) => d.document_type === type);
        if (!found) return 'not_started';
        if (found.status === 'approved') return 'approved';
        if (found.status === 'submitted') return 'submitted';
        return 'draft';
      };

      const attStatus = getDocStatus('attendance_sheet');
      const outlineStatus = getDocStatus('course_outline');
      const schemeStatus = getDocStatus('scheme_of_work');
      const recordStatus = getDocStatus('record_of_work');

      const approvedCount = [attStatus, outlineStatus, schemeStatus, recordStatus].filter((s) => s === 'approved').length;
      const rate = Math.round((approvedCount / 4) * 100);

      return {
        allocationId: alloc.id,
        unitCode: unit?.code ?? 'Unit',
        unitName: unit?.name ?? 'Unit Name',
        cohortName: cohort?.name ?? 'Cohort',
        trainerName: trainer?.full_name ?? 'Unassigned',
        attendanceSheetStatus: attStatus,
        courseOutlineStatus: outlineStatus,
        schemeOfWorkStatus: schemeStatus,
        recordOfWorkStatus: recordStatus,
        approvedCount,
        totalRequired: 4,
        complianceRate: rate,
      };
    });

    // ==========================================
    // EXECUTIVE SUMMARY KPI AGGREGATION
    // ==========================================
    const totalAllocatedHours = workloadItems.reduce((sum, w) => sum + w.allocatedHours, 0);
    const avgWorkloadHours = workloadItems.length > 0 ? Math.round((totalAllocatedHours / workloadItems.length) * 10) / 10 : 0;

    const totalOfferings = allocationItems.length;
    const allocatedOfferings = allocationItems.filter((a) => a.status === 'allocated').length;
    const allocRate = totalOfferings > 0 ? Math.round((allocatedOfferings / totalOfferings) * 100) : 0;

    const totalMarkbooks = assessmentItems.length;
    const finalisedAssessments = assessmentItems.filter((a) => a.isExamFinalized).length;
    const assessRate = totalMarkbooks > 0 ? Math.round((finalisedAssessments / totalMarkbooks) * 100) : 0;

    const totalEligibleStudents = registrationItems.reduce((sum, r) => sum + r.eligibleStudentCount, 0);
    const totalRegStudents = registrationItems.reduce((sum, r) => sum + r.totalRegisteredCount, 0);
    const regRate = totalEligibleStudents > 0 ? Math.round((totalRegStudents / totalEligibleStudents) * 100) : 0;

    const totalAttendanceSessions = attendanceItems.reduce((sum, a) => sum + a.totalSessionsScheduled, 0);
    const completedAttendanceSessions = attendanceItems.reduce((sum, a) => sum + a.completedSessions, 0);
    const attSessionRate = totalAttendanceSessions > 0 ? Math.round((completedAttendanceSessions / totalAttendanceSessions) * 100) : 0;
    const avgAttRate = attendanceItems.length > 0 ? Math.round(attendanceItems.reduce((sum, a) => sum + a.averageAttendanceRate, 0) / attendanceItems.length) : 0;

    const totalRequiredDocs = documentItems.length * 4;
    const totalApprovedDocs = documentItems.reduce((sum, d) => sum + d.approvedCount, 0);
    const docComplianceRate = totalRequiredDocs > 0 ? Math.round((totalApprovedDocs / totalRequiredDocs) * 100) : 0;

    const summary: ExecutiveReportSummary = {
      trainerWorkload: {
        totalTrainers: workloadItems.length,
        optimalCount: workloadItems.filter((w) => w.workloadStatus === 'optimal').length,
        underloadCount: workloadItems.filter((w) => w.workloadStatus === 'underload').length,
        overloadCount: workloadItems.filter((w) => w.workloadStatus === 'overload').length,
        totalWeeklyHours: totalAllocatedHours,
        averageWeeklyHours: avgWorkloadHours,
      },
      teachingAllocations: {
        totalOfferings,
        allocatedCount: allocatedOfferings,
        unallocatedCount: totalOfferings - allocatedOfferings,
        allocationRate: allocRate,
      },
      assessments: {
        totalMarkbooks,
        rosterLockedCount: assessmentItems.filter((a) => a.isPopulationLocked).length,
        finalisedCount: finalisedAssessments,
        publishedCount: assessmentItems.filter((a) => a.isPublished).length,
        totalMissingMarks: assessmentItems.reduce((sum, a) => sum + a.missingMarksCount, 0),
        completionRate: assessRate,
      },
      registration: {
        totalCohorts: registrationItems.length,
        eligibleStudents: totalEligibleStudents,
        registeredStudents: totalRegStudents,
        registrationRate: regRate,
      },
      attendance: {
        totalSessions: totalAttendanceSessions,
        completedSessions: completedAttendanceSessions,
        sessionCompletionRate: attSessionRate,
        averageStudentAttendanceRate: avgAttRate,
      },
      documents: {
        totalRequired: totalRequiredDocs,
        approvedCount: totalApprovedDocs,
        submittedCount: (teachingDocsData ?? []).filter((d) => d.status === 'submitted').length,
        draftCount: (teachingDocsData ?? []).filter((d) => d.status === 'draft').length,
        complianceRate: docComplianceRate,
      },
    };

    return {
      periods,
      selectedPeriodId: activePeriod.id,
      selectedPeriodName: activePeriod.name,
      departmentName: profile.departmentName ?? 'Department',
      generatedAt: new Date().toISOString(),
      summary,
      workload: workloadItems,
      allocations: allocationItems,
      assessments: assessmentItems,
      registration: registrationItems,
      attendance: attendanceItems,
      documents: documentItems,
    };
  }
);
