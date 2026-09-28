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

export async function getStaffOnlineMarkState(
  assessmentId: string,
): Promise<StaffOnlineMarkState[]> {
  const supabase = await createClient();

  let targetId = assessmentId;

  if (targetId.startsWith('alloc-')) {
    const allocId = targetId.replace('alloc-', '');
    const { data: alloc } = await supabase
      .from('teaching_allocations')
      .select('academic_period_id, unit_id')
      .eq('id', allocId)
      .maybeSingle();

    if (alloc) {
      const { data: eventData } = await supabase
        .from('assessment_events')
        .select('id')
        .eq('academic_period_id', alloc.academic_period_id)
        .eq('unit_id', alloc.unit_id)
        .in('assessment_type', ['exam', 'unit_markbook'])
        .maybeSingle();

      if (eventData?.id) {
        targetId = eventData.id;
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
  if (!isUUID) {
    return [];
  }

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
        .eq(
          'assessment_id',
          targetId,
        ),

      supabase
        .from(
          'assessment_results',
        )
        .select(
          'student_id, component_marks, operational_result_status, imported_at',
        )
        .eq(
          'assessment_event_id',
          assessmentId,
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

  const draftByStudent =
    new Map(
      drafts.map(
        (row) => [
          asString(
            row.student_id,
          ) ??
            '',
          row,
        ],
      ),
    );

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
