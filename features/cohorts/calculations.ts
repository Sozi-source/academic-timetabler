export interface CohortAcademicPeriodWindow {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  sequenceNumber: number;
  academicYearStartsOn: string;
}

export type CohortProgressionState =
  | 'not_started'
  | 'in_progress'
  | 'completed';

export interface CohortProgressionCalculation {
  progressionState:
    CohortProgressionState;

  intakeAcademicPeriod:
    CohortAcademicPeriodWindow;

  activeAcademicPeriod:
    CohortAcademicPeriodWindow;

  finalAcademicPeriod:
    CohortAcademicPeriodWindow;

  expectedCompletionDate: string;

  currentAcademicPeriodNumber:
    number | null;

  /**
   * Compatibility value for the existing non-null database
   * column. Live UI and scheduling logic should use
   * progressionState and currentAcademicPeriodNumber.
   */
  persistedAcademicPeriodNumber: number;
}

export type CohortProgressionResult =
  | {
      status: 'success';
      calculation:
        CohortProgressionCalculation;
    }
  | {
      status: 'error';
      message: string;
    };

function isIsoDate(
  value: string,
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value,
  );
}

function comparePeriods(
  first:
    CohortAcademicPeriodWindow,
  second:
    CohortAcademicPeriodWindow,
) {
  const yearComparison =
    first.academicYearStartsOn.localeCompare(
      second.academicYearStartsOn,
    );

  if (yearComparison !== 0) {
    return yearComparison;
  }

  const sequenceComparison =
    first.sequenceNumber -
    second.sequenceNumber;

  if (sequenceComparison !== 0) {
    return sequenceComparison;
  }

  return first.startsOn.localeCompare(
    second.startsOn,
  );
}

function validateAndOrderAcademicPeriods(
  academicPeriods:
    CohortAcademicPeriodWindow[],
):
  | {
      status: 'success';
      periods:
        CohortAcademicPeriodWindow[];
    }
  | {
      status: 'error';
      message: string;
    } {
  if (academicPeriods.length === 0) {
    return {
      status: 'error',
      message:
        'No Academic Periods are configured.',
    };
  }

  const ids = new Set<string>();

  for (const period of academicPeriods) {
    if (ids.has(period.id)) {
      return {
        status: 'error',
        message:
          `Academic Period "${period.name}" is duplicated.`,
      };
    }

    ids.add(period.id);

    if (
      !isIsoDate(period.startsOn) ||
      !isIsoDate(period.endsOn) ||
      !isIsoDate(
        period.academicYearStartsOn,
      )
    ) {
      return {
        status: 'error',
        message:
          `Academic Period "${period.name}" has invalid dates.`,
      };
    }

    if (
      period.startsOn >
      period.endsOn
    ) {
      return {
        status: 'error',
        message:
          `Academic Period "${period.name}" ends before it starts.`,
      };
    }

    if (
      !Number.isInteger(
        period.sequenceNumber,
      ) ||
      period.sequenceNumber < 1
    ) {
      return {
        status: 'error',
        message:
          `Academic Period "${period.name}" has an invalid sequence number.`,
      };
    }
  }

  const periods = [
    ...academicPeriods,
  ].sort(comparePeriods);

  for (
    let index = 1;
    index < periods.length;
    index += 1
  ) {
    const previous =
      periods[index - 1];

    const current =
      periods[index];

    if (
      current.startsOn <=
      previous.endsOn
    ) {
      return {
        status: 'error',
        message:
          `Academic Periods "${previous.name}" and "${current.name}" overlap.`,
      };
    }
  }

  const periodsByAcademicYear =
    new Map<
      string,
      CohortAcademicPeriodWindow[]
    >();

  for (const period of periods) {
    const existing =
      periodsByAcademicYear.get(
        period.academicYearStartsOn,
      ) ?? [];

    existing.push(period);

    periodsByAcademicYear.set(
      period.academicYearStartsOn,
      existing,
    );
  }

  for (
    const yearPeriods of
    periodsByAcademicYear.values()
  ) {
    const orderedYearPeriods =
      [...yearPeriods].sort(
        (first, second) =>
          first.sequenceNumber -
          second.sequenceNumber,
      );

    for (
      let index = 0;
      index <
      orderedYearPeriods.length;
      index += 1
    ) {
      const expectedSequence =
        index + 1;

      const period =
        orderedYearPeriods[index];

      if (
        period.sequenceNumber !==
        expectedSequence
      ) {
        return {
          status: 'error',
          message:
            `Academic Period sequence is incomplete before "${period.name}". Expected sequence ${expectedSequence}.`,
        };
      }
    }
  }

  return {
    status: 'success',
    periods,
  };
}

export function calculateCohortProgression({
  intakeDate,
  totalAcademicPeriods,
  academicPeriods,
  activeAcademicPeriodIds,
}: {
  intakeDate: string;

  totalAcademicPeriods: number;

  academicPeriods:
    CohortAcademicPeriodWindow[];

  activeAcademicPeriodIds:
    string[];
}): CohortProgressionResult {
  if (!isIsoDate(intakeDate)) {
    return {
      status: 'error',
      message:
        'Enter a valid intake date.',
    };
  }

  if (
    !Number.isInteger(
      totalAcademicPeriods,
    ) ||
    totalAcademicPeriods < 1
  ) {
    return {
      status: 'error',
      message:
        'The programme has no valid Academic Period duration.',
    };
  }

  if (
    activeAcademicPeriodIds.length !==
    1
  ) {
    return {
      status: 'error',
      message:
        activeAcademicPeriodIds.length ===
        0
          ? 'No active Academic Period is configured.'
          : 'More than one Academic Period is active.',
    };
  }

  const orderedResult =
    validateAndOrderAcademicPeriods(
      academicPeriods,
    );

  if (
    orderedResult.status === 'error'
  ) {
    return orderedResult;
  }

  const orderedPeriods =
    orderedResult.periods;

  const intakeIndex =
    orderedPeriods.findIndex(
      (period) =>
        period.startsOn <= intakeDate &&
        period.endsOn >= intakeDate,
    );

  if (intakeIndex < 0) {
    return {
      status: 'error',
      message:
        'No Academic Period covers the selected intake date.',
    };
  }

  const finalIndex =
    intakeIndex +
    totalAcademicPeriods -
    1;

  const finalAcademicPeriod =
    orderedPeriods[finalIndex];

  if (!finalAcademicPeriod) {
    const configuredFromIntake =
      orderedPeriods.length -
      intakeIndex;

    return {
      status: 'error',
      message:
        `The programme requires ${totalAcademicPeriods} periods, but only ${configuredFromIntake} are configured from the intake period.`,
    };
  }

  const activeAcademicPeriodId =
    activeAcademicPeriodIds[0];

  const activeIndex =
    orderedPeriods.findIndex(
      (period) =>
        period.id ===
        activeAcademicPeriodId,
    );

  if (activeIndex < 0) {
    return {
      status: 'error',
      message:
        'The active Academic Period is unavailable.',
    };
  }

  const activeAcademicPeriod =
    orderedPeriods[activeIndex];

  if (activeIndex < intakeIndex) {
    return {
      status: 'success',
      calculation: {
        progressionState:
          'not_started',

        intakeAcademicPeriod:
          orderedPeriods[intakeIndex],

        activeAcademicPeriod,

        finalAcademicPeriod,

        expectedCompletionDate:
          finalAcademicPeriod.endsOn,

        currentAcademicPeriodNumber:
          null,

        persistedAcademicPeriodNumber:
          1,
      },
    };
  }

  if (activeIndex > finalIndex) {
    return {
      status: 'success',
      calculation: {
        progressionState:
          'completed',

        intakeAcademicPeriod:
          orderedPeriods[intakeIndex],

        activeAcademicPeriod,

        finalAcademicPeriod,

        expectedCompletionDate:
          finalAcademicPeriod.endsOn,

        currentAcademicPeriodNumber:
          null,

        persistedAcademicPeriodNumber:
          totalAcademicPeriods,
      },
    };
  }

  const currentAcademicPeriodNumber =
    activeIndex -
    intakeIndex +
    1;

  return {
    status: 'success',
    calculation: {
      progressionState:
        'in_progress',

      intakeAcademicPeriod:
        orderedPeriods[intakeIndex],

      activeAcademicPeriod,

      finalAcademicPeriod,

      expectedCompletionDate:
        finalAcademicPeriod.endsOn,

      currentAcademicPeriodNumber,

      persistedAcademicPeriodNumber:
        currentAcademicPeriodNumber,
    },
  };
}

/**
 * Compatibility wrapper for existing consumers that only
 * require the completion date.
 */
export function calculateCohortCompletion({
  intakeDate,
  totalAcademicPeriods,
  academicPeriods,
}: {
  intakeDate: string;
  totalAcademicPeriods: number;
  academicPeriods:
    CohortAcademicPeriodWindow[];
}) {
  const orderedResult =
    validateAndOrderAcademicPeriods(
      academicPeriods,
    );

  if (
    orderedResult.status === 'error'
  ) {
    return orderedResult;
  }

  const intakeIndex =
    orderedResult.periods.findIndex(
      (period) =>
        period.startsOn <= intakeDate &&
        period.endsOn >= intakeDate,
    );

  if (intakeIndex < 0) {
    return {
      status: 'error' as const,
      message:
        'No Academic Period covers the selected intake date.',
    };
  }

  const finalIndex =
    intakeIndex +
    totalAcademicPeriods -
    1;

  const finalAcademicPeriod =
    orderedResult.periods[
      finalIndex
    ];

  if (!finalAcademicPeriod) {
    return {
      status: 'error' as const,
      message:
        `The programme requires ${totalAcademicPeriods} periods, but insufficient future periods are configured.`,
    };
  }

  return {
    status: 'success' as const,
    calculation: {
      intakeAcademicPeriod:
        orderedResult.periods[
          intakeIndex
        ],

      finalAcademicPeriod,

      expectedCompletionDate:
        finalAcademicPeriod.endsOn,
    },
  };
}