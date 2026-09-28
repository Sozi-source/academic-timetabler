export type OperationalAssessmentResultStatus =
  | 'sat'
  | 'absent'
  | 'missing_mark'
  | 'pending'
  | string;

export interface AssessmentAnalysisResultRow {
  assessmentId: string;
  studentId: string;
  cohortId: string | null;
  status: OperationalAssessmentResultStatus;
  mark: number | null;
  grade?: string | null;
}

export interface AssessmentAnalysisSummary {
  registered: number;
  sat: number;
  absent: number;
  missing: number;
  numericMarks: number[];
  mean: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  passed: number | null;
  failed: number | null;
  passRate: number | null;
  meanPercentage: number | null;
}

function round(
  value: number,
): number {
  return Math.round(
    value * 100,
  ) / 100;
}

function median(
  values: number[],
): number | null {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  const sorted =
    [...values].sort(
      (
        first,
        second,
      ) =>
        first -
        second,
    );

  const middle =
    Math.floor(
      sorted.length /
        2,
    );

  if (
    sorted.length %
      2 ===
    1
  ) {
    return round(
      sorted[middle],
    );
  }

  return round(
    (
      sorted[
        middle - 1
      ] +
      sorted[middle]
    ) /
      2,
  );
}

export function calculateAssessmentAnalysis({
  registeredPopulation,
  rows,
  maximumMark = null,
  passMark = null,
}: {
  registeredPopulation: number;
  rows: AssessmentAnalysisResultRow[];
  maximumMark?: number | null;
  passMark?: number | null;
}): AssessmentAnalysisSummary {
  const normalizedRegistered =
    Math.max(
      0,
      Math.trunc(
        registeredPopulation,
      ),
    );

  const satRows =
    rows.filter(
      (row) =>
        row.status ===
        'sat',
    );

  const numericMarks =
    satRows
      .map(
        (row) =>
          row.mark,
      )
      .filter(
        (
          mark,
        ): mark is number =>
          typeof mark ===
            'number' &&
          Number.isFinite(
            mark,
          ),
      );

  const absent =
    rows.filter(
      (row) =>
        row.status ===
        'absent',
    ).length;

  const explicitMissing =
    rows.filter(
      (row) =>
        row.status ===
          'missing_mark' ||
        row.status ===
          'pending',
    ).length;

  const representedStudents =
    new Set(
      rows.map(
        (row) =>
          row.studentId,
      ),
    ).size;

  const unresolved =
    Math.max(
      normalizedRegistered -
        representedStudents,
      0,
    );

  const missing =
    explicitMissing +
    unresolved;

  const mean =
    numericMarks.length >
    0
      ? round(
          numericMarks.reduce(
            (
              total,
              mark,
            ) =>
              total +
              mark,
            0,
          ) /
            numericMarks.length,
        )
      : null;

  const ruleReady =
    typeof maximumMark ===
      'number' &&
    Number.isFinite(
      maximumMark,
    ) &&
    maximumMark >
      0 &&
    typeof passMark ===
      'number' &&
    Number.isFinite(
      passMark,
    ) &&
    passMark >=
      0 &&
    passMark <=
      maximumMark;

  const passed =
    ruleReady
      ? numericMarks.filter(
          (mark) =>
            mark >=
            passMark,
        ).length
      : null;

  const failed =
    ruleReady &&
    passed !==
      null
      ? numericMarks.length -
        passed
      : null;

  const passRate =
    ruleReady &&
    passed !==
      null &&
    numericMarks.length >
      0
      ? round(
          (
            passed /
            numericMarks.length
          ) *
            100,
        )
      : null;

  const meanPercentage =
    ruleReady &&
    mean !==
      null
      ? round(
          (
            mean /
            maximumMark
          ) *
            100,
        )
      : null;

  return {
    registered:
      normalizedRegistered,
    sat:
      satRows.length,
    absent,
    missing,
    numericMarks,
    mean,
    median:
      median(
        numericMarks,
      ),
    minimum:
      numericMarks.length >
      0
        ? Math.min(
            ...numericMarks,
          )
        : null,
    maximum:
      numericMarks.length >
      0
        ? Math.max(
            ...numericMarks,
          )
        : null,
    passed,
    failed,
    passRate,
    meanPercentage,
  };
}

export function deriveAssessmentBundleStatus(
  statuses: Array<
    string | null
  >,
): string {
  const normalized =
    statuses.filter(
      (
        value,
      ): value is string =>
        Boolean(
          value,
        ),
    );

  if (
    normalized.length ===
    0
  ) {
    return 'draft';
  }

  if (
    normalized.every(
      (status) =>
        status ===
        'archived',
    )
  ) {
    return 'archived';
  }

  if (
    normalized.every(
      (status) =>
        status ===
          'finalised' ||
        status ===
          'archived',
    )
  ) {
    return 'finalised';
  }

  if (
    normalized.every(
      (status) =>
        status ===
          'submitted' ||
        status ===
          'finalised' ||
        status ===
          'archived',
    )
  ) {
    return 'submitted';
  }

  if (
    normalized.some(
      (status) =>
        status ===
        'open',
    )
  ) {
    return 'open';
  }

  if (
    normalized.some(
      (status) =>
        status ===
        'generated',
    )
  ) {
    return 'generated';
  }

  return 'draft';
}

export function formatAssessmentMetric(
  value: number | null,
): string {
  if (
    value ===
    null
  ) {
    return '—';
  }

  return Number.isInteger(
    value,
  )
    ? String(
        value,
      )
    : value.toFixed(
        2,
      );
}