import 'server-only';

import {
  createClient,
} from '@/lib/supabase/server';

export interface AssessmentRuleRecord {
  academicPeriodId: string;
  unitId: string;
  assessmentType:
    | 'cat'
    | 'exam';
  maximumMark: number;
  passMark: number;
}

function asNumber(
  value: unknown,
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
    value.trim() !==
      ''
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

export async function getAssessmentRuleForAssessment(
  assessmentId: string,
): Promise<AssessmentRuleRecord | null> {
  const supabase =
    await createClient();

  const {
    data: workspace,
    error: workspaceError,
  } = await supabase
    .from(
      'assessment_event_workspace',
    )
    .select(
      'academic_period_id, unit_id, assessment_type',
    )
    .eq(
      'id',
      assessmentId,
    )
    .maybeSingle();

  if (
    workspaceError
  ) {
    throw new Error(
      `Unable to load assessment rule context: ${workspaceError.message}`,
    );
  }

  if (
    !workspace ||
    !workspace.academic_period_id ||
    !workspace.unit_id ||
    (
      workspace.assessment_type !==
        'cat' &&
      workspace.assessment_type !==
        'exam'
    )
  ) {
    return null;
  }

  const {
    data: rule,
    error: ruleError,
  } = await supabase
    .from(
      'assessment_rules',
    )
    .select(
      'academic_period_id, unit_id, assessment_type, maximum_mark, pass_mark',
    )
    .eq(
      'academic_period_id',
      workspace.academic_period_id,
    )
    .eq(
      'unit_id',
      workspace.unit_id,
    )
    .eq(
      'assessment_type',
      workspace.assessment_type,
    )
    .maybeSingle();

  if (
    ruleError
  ) {
    throw new Error(
      `Unable to load assessment rule: ${ruleError.message}`,
    );
  }

  if (!rule) {
    return null;
  }

  const maximumMark =
    asNumber(
      rule.maximum_mark,
    );

  const passMark =
    asNumber(
      rule.pass_mark,
    );

  if (
    maximumMark ===
      null ||
    passMark ===
      null
  ) {
    return null;
  }

  return {
    academicPeriodId:
      rule.academic_period_id,
    unitId:
      rule.unit_id,
    assessmentType:
      rule.assessment_type as
        | 'cat'
        | 'exam',
    maximumMark,
    passMark,
  };
}
