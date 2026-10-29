export const onlineMarkComponents = [
  {
    key:
      'assignment',
    label:
      'Assignment',
    maximum:
      5,
  },
  {
    key:
      'presentation',
    label:
      'Presentation',
    maximum:
      10,
  },
  {
    key:
      'rat',
    label:
      'RAT',
    maximum:
      15,
  },
  {
    key:
      'cat',
    label:
      'CAT',
    maximum:
      15,
  },
  {
    key:
      'exam',
    label:
      'Exam',
    maximum:
      70,
  },
] as const;

export type OnlineMarkComponentKey =
  typeof onlineMarkComponents[number]['key'];

export interface OnlineMarkValues {
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
}

export interface ParsedOnlineMarkInput {
  valid:
    boolean;
  mark:
    number |
    null;
  message:
    string |
    null;
  isAbsent?:
    boolean;
}

export function parseOnlineMarkInput(
  value:
    string,
  maximum:
    number,
  allowAbsent = false,
): ParsedOnlineMarkInput {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return {
      valid:
        true,
      mark:
        null,
      message:
        null,
    };
  }

  if (
    allowAbsent &&
    (trimmed.toUpperCase() === 'AB' ||
     trimmed.toLowerCase() === 'absent' ||
     trimmed.toUpperCase() === 'A')
  ) {
    return {
      valid:
        true,
      mark:
        null,
      isAbsent:
        true,
      message:
        null,
    };
  }

  const mark =
    Number(
      trimmed,
    );

  if (
    !Number.isFinite(
      mark,
    )
  ) {
    return {
      valid:
        false,
      mark:
        null,
      message:
        allowAbsent ? `Enter a mark (0–${maximum}) or AB.` : 'Enter a numeric mark.',
    };
  }

  if (
    mark < 0 ||
    mark >
      maximum
  ) {
    return {
      valid:
        false,
      mark:
        null,
      message:
        `Mark must be between 0 and ${maximum}.`,
    };
  }

  return {
    valid:
      true,
    mark,
    message:
      null,
  };
}

export function calculateRatCatAverage({
  rat,
  cat,
}: {
  rat:
    number |
    null;
  cat:
    number |
    null;
}): number | null {
  if (
    cat ===
      null
  ) {
    return null;
  }

  // If a student misses RAT, 0 is awarded
  const effectiveRat = rat ?? 0;

  return (
    effectiveRat +
    cat
  ) / 2;
}

export function calculateOnlineFinalTotal(
  values:
    OnlineMarkValues,
  absent:
    boolean,
): number | null {
  if (
    absent
  ) {
    return null;
  }

  if (
    values.cat === null ||
    values.exam === null
  ) {
    return null;
  }

  const ratCatAverage =
    calculateRatCatAverage({
      rat:
        values.rat,
      cat:
        values.cat,
    });

  if (
    ratCatAverage ===
      null
  ) {
    return null;
  }

  // If a student misses assignment, presentation, or RAT, 0 is awarded
  const effectiveAssignment = values.assignment ?? 0;
  const effectivePresentation = values.presentation ?? 0;

  return (
    effectiveAssignment +
    effectivePresentation +
    ratCatAverage +
    values.exam
  );
}

export function missingOnlineComponentCount({
  values,
  absent,
}: {
  values:
    OnlineMarkValues;
  absent:
    boolean;
}): number {
  let missing = 0;

  if (values.assignment === null) {
    missing += 1;
  }
  if (values.presentation === null) {
    missing += 1;
  }
  if (values.rat === null) {
    missing += 1;
  }
  if (values.cat === null) {
    missing += 1;
  }
  if (!absent && values.exam === null) {
    missing += 1;
  }

  return missing;
}

export function getUnfilledColumnsSummary(
  rows: Array<{
    student: { fullName: string; attendanceStatus: 'expected' | 'absent' };
    marks: OnlineMarkValues;
    isAbsent?: boolean;
    catAbsent?: boolean;
  }>,
): {
  totalMissing: number;
  missingAssignment: number;
  missingPresentation: number;
  missingRat: number;
  missingCat: number;
  missingExam: number;
  incompleteStudentCount: number;
} {
  let missingAssignment = 0;
  let missingPresentation = 0;
  let missingRat = 0;
  let missingCat = 0;
  let missingExam = 0;
  let incompleteStudentCount = 0;

  for (const row of rows) {
    let studentIncomplete = false;
    if (row.marks.assignment === null) {
      missingAssignment += 1;
      studentIncomplete = true;
    }
    if (row.marks.presentation === null) {
      missingPresentation += 1;
      studentIncomplete = true;
    }
    if (row.marks.rat === null) {
      missingRat += 1;
      studentIncomplete = true;
    }
    if (row.marks.cat === null && !row.catAbsent) {
      missingCat += 1;
      studentIncomplete = true;
    }
    const isAbsent = Boolean(row.isAbsent || row.student.attendanceStatus === 'absent');
    if (!isAbsent && row.marks.exam === null) {
      missingExam += 1;
      studentIncomplete = true;
    }
    if (studentIncomplete) {
      incompleteStudentCount += 1;
    }
  }

  const totalMissing =
    missingAssignment + missingPresentation + missingRat + missingCat + missingExam;

  return {
    totalMissing,
    missingAssignment,
    missingPresentation,
    missingRat,
    missingCat,
    missingExam,
    incompleteStudentCount,
  };
}

export function formatUnfilledColumnsMessage(summary: {
  missingAssignment: number;
  missingPresentation: number;
  missingRat: number;
  missingCat: number;
  missingExam: number;
}): string {
  const parts: string[] = [];
  if (summary.missingAssignment) parts.push(`${summary.missingAssignment} in Assignment`);
  if (summary.missingPresentation) parts.push(`${summary.missingPresentation} in Presentation`);
  if (summary.missingRat) parts.push(`${summary.missingRat} in RAT`);
  if (summary.missingCat) parts.push(`${summary.missingCat} in CAT`);
  if (summary.missingExam) parts.push(`${summary.missingExam} in Exam`);
  return parts.join(', ');
}

export function canEditOnlineMarks(
  workflowStatus:
    string | null,
): boolean {
  return ![
    'submitted',
    'finalised',
    'archived',
  ].includes(
    workflowStatus ??
      '',
  );
}
