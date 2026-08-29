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
}

export function parseOnlineMarkInput(
  value:
    string,
  maximum:
    number,
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
        'Enter a numeric mark.',
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
  // Assignment, Presentation, and RAT default to 0 if missed.
  // Required components to complete are CAT and Exam (unless absent).
  let missing = 0;

  if (values.cat === null) {
    missing += 1;
  }

  if (!absent && values.exam === null) {
    missing += 1;
  }

  return missing;
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
