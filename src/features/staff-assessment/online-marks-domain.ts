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
    rat ===
      null ||
    cat ===
      null
  ) {
    return null;
  }

  return (
    rat +
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

  const ratCatAverage =
    calculateRatCatAverage({
      rat:
        values.rat,
      cat:
        values.cat,
    });

  if (
    values.assignment ===
      null ||
    values.presentation ===
      null ||
    ratCatAverage ===
      null ||
    values.exam ===
      null
  ) {
    return null;
  }

  return (
    values.assignment +
    values.presentation +
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
  let missing =
    [
      values.assignment,
      values.presentation,
      values.rat,
      values.cat,
    ].filter(
      (value) =>
        value ===
        null,
    ).length;

  if (
    !absent &&
    values.exam ===
      null
  ) {
    missing +=
      1;
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
