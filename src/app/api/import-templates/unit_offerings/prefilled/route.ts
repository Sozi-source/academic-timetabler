import 'server-only';

import type {
  NextRequest,
} from 'next/server';
import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  generateImportTemplate,
} from '@/features/imports/template-generator';
import {
  buildPrefilledUnitOfferingRows,
} from '@/features/imports/unit-offerings/prefilled-template';
import {
  unitOfferingsImportTemplate,
} from '@/features/imports/unit-offerings/template';
import {
  createClient,
} from '@/lib/supabase/server';

interface AcademicPeriodRow {
  id: string;
  code: string;
  name: string;
}

interface ProgrammeRow {
  id: string;
  code: string;
  name: string;
}

interface CohortRow {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  current_academic_period_number:
    number;
}

interface UnitRow {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  academic_period_number: number;
  theory_hours: number | string;
  practical_hours: number | string;
  weekly_sessions: number;
}

function sanitizeFileName(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    );
}

export async function GET(
  request: NextRequest,
) {
  await requireHodAccess();

  const academicPeriodId =
    request.nextUrl.searchParams
      .get('academicPeriodId')
      ?.trim();

  if (!academicPeriodId) {
    return NextResponse.json(
      {
        message:
          'Select an Academic Period before downloading the prefilled template.',
      },
      {
        status: 400,
      },
    );
  }

  const supabase =
    await createClient();

  const {
    data: academicPeriod,
    error: academicPeriodError,
  } = await supabase
    .from('academic_periods')
    .select(`
      id,
      code,
      name
    `)
    .eq('id', academicPeriodId)
    .maybeSingle();

  if (academicPeriodError) {
    return NextResponse.json(
      {
        message:
          `Unable to load the Academic Period: ${academicPeriodError.message}`,
      },
      {
        status: 500,
      },
    );
  }

  if (!academicPeriod) {
    return NextResponse.json(
      {
        message:
          'The selected Academic Period was not found.',
      },
      {
        status: 404,
      },
    );
  }

  const [
    programmeResult,
    cohortResult,
    unitResult,
  ] = await Promise.all([
    supabase
      .from('programmes')
      .select(`
        id,
        code,
        name
      `)
      .eq('is_active', true)
      .eq(
        'is_timetable_available',
        true,
      ),

    supabase
      .from('cohorts')
      .select(`
        id,
        programme_id,
        code,
        name,
        current_academic_period_number
      `)
      .eq('status', 'active')
      .eq(
        'is_timetable_available',
        true,
      ),

    supabase
      .from('units')
      .select(`
        id,
        programme_id,
        code,
        name,
        academic_period_number,
        theory_hours,
        practical_hours,
        weekly_sessions
      `)
      .eq('is_active', true)
      .eq(
        'is_timetable_available',
        true,
      ),
  ]);

  const relationshipError =
    programmeResult.error ??
    cohortResult.error ??
    unitResult.error;

  if (relationshipError) {
    return NextResponse.json(
      {
        message:
          `Unable to prepare the prefilled template: ${relationshipError.message}`,
      },
      {
        status: 500,
      },
    );
  }

  const period =
    academicPeriod as AcademicPeriodRow;

  const programmes =
    (
      programmeResult.data ?? []
    ) as ProgrammeRow[];

  const validProgrammeIds =
    new Set(
      programmes.map(
        (programme) =>
          programme.id,
      ),
    );

  const cohorts =
    (
      (
        cohortResult.data ?? []
      ) as CohortRow[]
    )
      .filter((cohort) =>
        validProgrammeIds.has(
          cohort.programme_id,
        ),
      )
      .map((cohort) => ({
        id: cohort.id,
        programmeId:
          cohort.programme_id,
        code: cohort.code,
        name: cohort.name,
        currentAcademicPeriodNumber:
          cohort.current_academic_period_number,
      }));

  const units =
    (
      (
        unitResult.data ?? []
      ) as UnitRow[]
    )
      .filter((unit) =>
        validProgrammeIds.has(
          unit.programme_id,
        ),
      )
      .map((unit) => ({
        id: unit.id,
        programmeId:
          unit.programme_id,
        code: unit.code,
        name: unit.name,
        academicPeriodNumber:
          unit.academic_period_number,
        theoryHours:
          Number(unit.theory_hours),
        practicalHours:
          Number(
            unit.practical_hours,
          ),
        weeklySessions:
          unit.weekly_sessions,
      }));

  const rows =
    buildPrefilledUnitOfferingRows({
      academicPeriod: {
        id: period.id,
        code: period.code,
        name: period.name,
      },
      programmes:
        programmes.map(
          (programme) => ({
            id: programme.id,
            code: programme.code,
            name: programme.name,
          }),
        ),
      cohorts,
      units,
    });

  if (rows.length === 0) {
    return NextResponse.json(
      {
        message:
          'No eligible units were found. Register programme units and ensure active cohorts have the correct current academic stage.',
      },
      {
        status: 422,
      },
    );
  }

  const workbook =
    await generateImportTemplate(
      unitOfferingsImportTemplate,
      {
        rows,
        includeExampleRow:
          false,
      },
    );

  const periodFileName =
    sanitizeFileName(
      period.code ||
      period.name,
    );

  return new NextResponse(
    new Uint8Array(workbook),
    {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

        'Content-Disposition':
          `attachment; filename="unit-offerings-${periodFileName}-prefilled-v${unitOfferingsImportTemplate.version}.xlsx"`,

        'Cache-Control':
          'private, no-store, max-age=0',

        'X-Content-Type-Options':
          'nosniff',

        'X-Prefilled-Row-Count':
          String(rows.length),
      },
    },
  );
}