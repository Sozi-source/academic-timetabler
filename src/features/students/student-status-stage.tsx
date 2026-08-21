import type { StudentRow } from './types';

type StudentStageData = StudentRow & {
  current_stage?: {
    sequence_number?: number | null;
  } | {
    sequence_number?: number | null;
  }[] | null;
  current_cohort?: (
    StudentRow['current_cohort'] extends infer T ? T : never
  ) & {
    current_academic_period_number?: number | null;
  };
};

function relation<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

export function formatStudentStage(
  stageNumber: number | null | undefined,
): string {
  if (
    stageNumber === null ||
    stageNumber === undefined ||
    !Number.isFinite(stageNumber)
  ) {
    return 'â€”';
  }

  const stage = Math.trunc(stageNumber);

  if (stage < 1) {
    return 'â€”';
  }

  const year = Math.floor((stage - 1) / 3) + 1;
  const semester = ((stage - 1) % 3) + 1;

  return `Y${year}S${semester}`;
}

export function getStudentStatusLabel(
  lifecycleStatus: string | null | undefined,
  academicPhase: string | null | undefined,
): string {
  const lifecycle =
    lifecycleStatus?.trim().toLowerCase() ?? '';

  const phase =
    academicPhase?.trim().toLowerCase() ?? '';

  if (lifecycle === 'graduated') {
    return 'Graduated';
  }

  if (lifecycle === 'completed') {
    return 'Awaiting graduation';
  }

  if (lifecycle === 'deferred') {
    return 'Deferred';
  }

  if (lifecycle === 'dropped_out') {
    return 'Dropped out';
  }

  if (lifecycle === 'on_leave') {
    return 'On leave';
  }

  if (lifecycle === 'withdrawn') {
    return 'Withdrawn';
  }

  if (lifecycle === 'discontinued') {
    return 'Discontinued';
  }

  if (
    lifecycle === 'active' ||
    lifecycle === 'admitted'
  ) {
    if (phase === 'attachment') {
      return 'On attachment';
    }

    if (phase === 'clinical_rotation') {
      return 'Clinical rotation';
    }

    return 'In class';
  }

  if (phase === 'awaiting_graduation') {
    return 'Awaiting graduation';
  }

  if (phase === 'attachment') {
    return 'On attachment';
  }

  if (phase === 'clinical_rotation') {
    return 'Clinical rotation';
  }

  if (phase === 'in_class') {
    return 'In class';
  }

  const value = lifecycle || phase;

  if (!value) {
    return 'Status unavailable';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export function getStudentStageLabel(
  student: StudentRow,
): string {
  const value = student as StudentStageData;

  const currentStage =
    relation(value.current_stage);

  const cohort =
    relation(
      value.current_cohort as
        | StudentStageData['current_cohort']
        | StudentStageData['current_cohort'][]
        | null
        | undefined,
    );

  return formatStudentStage(
    currentStage?.sequence_number ??
      cohort?.current_academic_period_number ??
      null,
  );
}

export function StudentStatusStage({
  student,
}: {
  student: StudentRow;
}) {
  const statusLabel =
    getStudentStatusLabel(
      student.lifecycle_status,
      student.academic_phase,
    );

  const stageLabel =
    getStudentStageLabel(student);

  return (
    <span className="block min-w-24">
      <span className="block font-medium text-text-primary">
        {statusLabel}
      </span>
      <span className="mt-0.5 block text-[10px] font-semibold tracking-wide text-text-muted sm:text-[11px]">
        {stageLabel}
      </span>
    </span>
  );
}
