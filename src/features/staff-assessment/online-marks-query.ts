import 'server-only';

import {
  createClient,
} from '@/lib/supabase/server';

type UnknownRow =
  Record<string, unknown>;

function asString(
  value:
    unknown,
): string | null {
  return typeof value ===
    'string'
    ? value
    : null;
}

function asNumber(
  value:
    unknown,
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  if (
    typeof value ===
      'string' &&
    value.trim()
  ) {
    const parsed =
      Number(
        value,
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  }

  return null;
}

export interface StaffOnlineMarkState {
  studentId:
    string;
  assignment:
    number |
    null;
  presentation:
    number |
    null;
  rat:
    number |
    null;
  cat:
    number |
    null;
  exam:
    number |
    null;
  committed:
    boolean;
  committedStatus:
    string |
    null;
  updatedAt:
    string |
    null;
}

export interface StaffOnlineComponentSubmission {
  cohortId: string | null;
  component: string;
  submittedAt: string;
}

async function resolveAssessmentIdsWithSiblings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assessmentId: string,
): Promise<string[]> {
  let targetId = assessmentId;

  if (targetId.startsWith('alloc-')) {
    const allocationId = targetId.replace('alloc-', '');
    const { data: allocation } = await supabase
      .from('teaching_allocations')
      .select('academic_period_id, unit_id')
      .eq('id', allocationId)
      .maybeSingle();
    if (!allocation) return [];

    const { data: event } = await supabase
      .from('assessment_events')
      .select('id')
      .eq('academic_period_id', allocation.academic_period_id)
      .eq('unit_id', allocation.unit_id)
      .eq('assessment_type', 'exam')
      .maybeSingle();
    if (event?.id) {
      targetId = event.id;
    } else {
      const { data: provisionedId } = await supabase.rpc(
        'ensure_unit_markbook_ready',
        {
          p_academic_period_id: allocation.academic_period_id,
          p_unit_id: allocation.unit_id,
        },
      );
      if (provisionedId) {
        targetId = provisionedId as string;
      } else {
        return [];
      }
    }
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
  if (!isUUID) return [];

  const targetEventIds = [targetId];

  // Discover sibling assessment events in the same shared offering or approved equivalence group
  const { data: targetEvent } = await supabase
    .from('assessment_events')
    .select('id, unit_id, academic_period_id')
    .eq('id', targetId)
    .maybeSingle();

  if (targetEvent?.unit_id && targetEvent?.academic_period_id) {
    const siblingUnitIds = new Set<string>();

    // 1. Shared offerings
    const { data: directOfferings } = await supabase
      .from('unit_offerings')
      .select('confirmed_shared_offering_id')
      .eq('academic_period_id', targetEvent.academic_period_id)
      .eq('unit_id', targetEvent.unit_id)
      .not('confirmed_shared_offering_id', 'is', null);

    const sharedOfferingId = directOfferings?.[0]?.confirmed_shared_offering_id;
    if (sharedOfferingId) {
      const { data: siblingOfferings } = await supabase
        .from('unit_offerings')
        .select('unit_id')
        .eq('academic_period_id', targetEvent.academic_period_id)
        .eq('confirmed_shared_offering_id', sharedOfferingId);

      for (const o of siblingOfferings ?? []) {
        if (o?.unit_id) siblingUnitIds.add(o.unit_id);
      }
    }

    // 2. Unit equivalence groups
    const { data: equivalenceMembers } = await supabase
      .from('unit_equivalence_members')
      .select('equivalence_group_id')
      .eq('unit_id', targetEvent.unit_id)
      .eq('status', 'approved');

    const groupIds = (equivalenceMembers ?? []).map((m) => m.equivalence_group_id).filter(Boolean);
    if (groupIds.length > 0) {
      const { data: siblingMembers } = await supabase
        .from('unit_equivalence_members')
        .select('unit_id')
        .in('equivalence_group_id', groupIds)
        .eq('status', 'approved');

      for (const m of siblingMembers ?? []) {
        if (m?.unit_id) siblingUnitIds.add(m.unit_id);
      }
    }

    const uniqueUnitIds = [...siblingUnitIds].filter((id) => id !== targetEvent.unit_id);
    if (uniqueUnitIds.length > 0) {
      const { data: siblingEvents } = await supabase
        .from('assessment_events')
        .select('id')
        .eq('academic_period_id', targetEvent.academic_period_id)
        .in('unit_id', uniqueUnitIds);

      for (const ev of siblingEvents ?? []) {
        if (ev?.id && !targetEventIds.includes(ev.id)) {
          targetEventIds.push(ev.id);
        }
      }
    }
  }

  return targetEventIds;
}

export async function getStaffOnlineMarkComponentSubmissions(
  assessmentId: string,
): Promise<StaffOnlineComponentSubmission[]> {
  const supabase = await createClient();
  const targetEventIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  if (targetEventIds.length === 0) return [];

  const { data, error } = await supabase
    .from('assessment_mark_component_submissions')
    .select('cohort_id,component_key,submitted_at')
    .in('assessment_id', targetEventIds);
  if (error) throw new Error(`Unable to load submitted mark components: ${error.message}`);

  const submissionMap = new Map<string, StaffOnlineComponentSubmission>();
  for (const row of data ?? []) {
    const key = `${row.cohort_id ?? 'all'}:${row.component_key}`;
    const existing = submissionMap.get(key);
    if (!existing || Date.parse(row.submitted_at) > Date.parse(existing.submittedAt)) {
      submissionMap.set(key, {
        cohortId: row.cohort_id,
        component: row.component_key,
        submittedAt: row.submitted_at,
      });
    }
  }
  return [...submissionMap.values()];
}

export async function getStaffOnlineMarkState(
  assessmentId: string,
): Promise<StaffOnlineMarkState[]> {
  const supabase = await createClient();
  const targetEventIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  if (targetEventIds.length === 0) return [];

  const [
    draftResult,
    resultResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'assessment_online_mark_drafts',
        )
        .select(
          'student_id, assignment_mark, presentation_mark, rat_mark, cat_mark, exam_mark, updated_at',
        )
        .in(
          'assessment_id',
          targetEventIds,
        ),

      supabase
        .from(
          'assessment_results',
        )
        .select(
          'student_id, component_marks, operational_result_status, imported_at',
        )
        .in(
          'assessment_event_id',
          targetEventIds,
        ),
    ]);

  const error =
    draftResult.error ??
    resultResult.error;

  if (error) {
    throw new Error(
      `Unable to load online marks: ${error.message}`,
    );
  }

  const drafts =
    (
      draftResult.data ??
      []
    ) as UnknownRow[];

  const results =
    (
      resultResult.data ??
      []
    ) as UnknownRow[];

  const draftByStudent = new Map<string, UnknownRow>();
  for (const row of drafts) {
    const studentId = asString(row.student_id);
    if (!studentId) continue;
    const existing = draftByStudent.get(studentId);
    if (!existing) {
      draftByStudent.set(studentId, row);
    } else {
      const hasMarks = (r: UnknownRow) =>
        r.assignment_mark !== null ||
        r.presentation_mark !== null ||
        r.rat_mark !== null ||
        r.cat_mark !== null ||
        r.exam_mark !== null;
      if (!hasMarks(existing) && hasMarks(row)) {
        draftByStudent.set(studentId, row);
      } else if (hasMarks(row) && String(row.updated_at ?? '') > String(existing.updated_at ?? '')) {
        draftByStudent.set(studentId, row);
      }
    }
  }

  const resultByStudent =
    new Map(
      results.map(
        (row) => [
          asString(
            row.student_id,
          ) ??
            '',
          row,
        ],
      ),
    );

  const studentIds =
    [
      ...new Set([
        ...draftByStudent.keys(),
        ...resultByStudent.keys(),
      ]),
    ].filter(
      Boolean,
    );

  return studentIds.map(
    (studentId) => {
      const draft =
        draftByStudent.get(
          studentId,
        );

      const result =
        resultByStudent.get(
          studentId,
        );

      const componentMarks =
        result
          ?.component_marks &&
        typeof result.component_marks ===
          'object' &&
        !Array.isArray(
          result.component_marks,
        )
          ? result.component_marks as
              UnknownRow
          : null;

      return {
        studentId,
        assignment:
          asNumber(
            componentMarks
              ?.assignment,
          ) ??
          asNumber(
            draft
              ?.assignment_mark,
          ),
        presentation:
          asNumber(
            componentMarks
              ?.presentation,
          ) ??
          asNumber(
            draft
              ?.presentation_mark,
          ),
        rat:
          asNumber(
            componentMarks
              ?.rat,
          ) ??
          asNumber(
            draft
              ?.rat_mark,
          ),
        cat:
          asNumber(
            componentMarks
              ?.cat1,
          ) ??
          asNumber(
            componentMarks
              ?.cat,
          ) ??
          asNumber(
            draft
              ?.cat_mark,
          ),
        exam:
          asNumber(
            componentMarks
              ?.exam,
          ) ??
          asNumber(
            draft
              ?.exam_mark,
          ),
        committed:
          Boolean(
            result,
          ),
        committedStatus:
          asString(
            result
              ?.operational_result_status,
          ),
        updatedAt:
          asString(
            result
              ?.imported_at,
          ) ??
          asString(
            draft
              ?.updated_at,
          ),
      };
    },
  );
}
