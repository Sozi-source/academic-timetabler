import type {
  ImportTemplateSeedRow,
} from '@/features/imports/template-generator';

export interface PrefilledAcademicPeriod {
  id: string;
  code: string;
  name: string;
}

export interface PrefilledProgramme {
  id: string;
  code: string;
  name: string;
}

export interface PrefilledCohort {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  currentAcademicPeriodNumber: number;
}

export interface PrefilledUnit {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  academicPeriodNumber: number;
  theoryHours: number;
  practicalHours: number;
  weeklySessions: number;
}

export interface BuildPrefilledUnitOfferingRowsInput {
  academicPeriod:
    PrefilledAcademicPeriod;

  programmes:
    PrefilledProgramme[];

  cohorts:
    PrefilledCohort[];

  units:
    PrefilledUnit[];
}

function getOfferingType(
  unit: PrefilledUnit,
) {
  return unit.practicalHours >
    unit.theoryHours
    ? 'practical'
    : 'classroom';
}

function getSessionDurationMinutes(
  unit: PrefilledUnit,
) {
  return getOfferingType(unit) ===
    'practical'
    ? 180
    : 120;
}

export function buildPrefilledUnitOfferingRows({
  academicPeriod,
  programmes,
  cohorts,
  units,
}: BuildPrefilledUnitOfferingRowsInput):
ImportTemplateSeedRow[] {
  const programmeById =
    new Map(
      programmes.map(
        (programme) => [
          programme.id,
          programme,
        ],
      ),
    );

  const unitsByProgrammeStage =
    new Map<
      string,
      PrefilledUnit[]
    >();

  for (const unit of units) {
    const key =
      `${unit.programmeId}:${unit.academicPeriodNumber}`;

    const current =
      unitsByProgrammeStage.get(
        key,
      ) ?? [];

    current.push(unit);

    unitsByProgrammeStage.set(
      key,
      current,
    );
  }

  const sortedCohorts = [
    ...cohorts,
  ].sort((first, second) => {
    const firstProgrammeName =
      programmeById.get(
        first.programmeId,
      )?.name ?? '';

    const secondProgrammeName =
      programmeById.get(
        second.programmeId,
      )?.name ?? '';

    return (
      firstProgrammeName.localeCompare(
        secondProgrammeName,
      ) ||
      first.name.localeCompare(
        second.name,
      )
    );
  });

  const rows:
  ImportTemplateSeedRow[] = [];

  for (const cohort of sortedCohorts) {
    const programme =
      programmeById.get(
        cohort.programmeId,
      );

    if (!programme) {
      continue;
    }

    const matchingUnits =
      unitsByProgrammeStage.get(
        `${cohort.programmeId}:${cohort.currentAcademicPeriodNumber}`,
      ) ?? [];

    const sortedUnits = [
      ...matchingUnits,
    ].sort((first, second) =>
      first.name.localeCompare(
        second.name,
      ),
    );

    for (const unit of sortedUnits) {
      rows.push({
        academicPeriod:
          academicPeriod.name ||
          academicPeriod.code,

        programmeName:
          programme.name,

        cohortName:
          cohort.name ||
          cohort.code,

        unitName:
          unit.name,

        unitCode:
          unit.code,

        offeringType:
          getOfferingType(unit),

        weeklySessions:
          Math.max(
            1,
            unit.weeklySessions,
          ),

        sessionDurationMinutes:
          getSessionDurationMinutes(
            unit,
          ),

        timetableEnabled:
          'Yes',

        status:
          'draft',

        sharedClassKey:
          null,

        preferredTrainer:
          null,

        preferredRoom:
          null,

        notes:
          null,
      });
    }
  }

  return rows;
}