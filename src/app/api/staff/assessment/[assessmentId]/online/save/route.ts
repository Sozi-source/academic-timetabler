import {
  NextResponse,
} from 'next/server';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  trainerCanAccessAssessment,
} from '@/features/staff-assessment/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

interface OnlineEntry {
  studentId?:
    unknown;
  assignment?:
    unknown;
  presentation?:
    unknown;
  rat?:
    unknown;
  cat?:
    unknown;
  exam?:
    unknown;
}

interface SavePayload {
  entries?:
    unknown;
}

interface RouteContext {
  params:
    Promise<{
      assessmentId:
        string;
    }>;
}

function nullableNumber(
  value:
    unknown,
):
  | number
  | null
  | undefined {
  if (
    value ===
      null
  ) {
    return null;
  }

  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  return undefined;
}

export async function POST(
  request:
    Request,
  {
    params,
  }: RouteContext,
) {
  await requireTrainerAccess();

  const {
    assessmentId,
  } =
    await params;

  if (
    !await trainerCanAccessAssessment(
      assessmentId,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'This assessment is outside your Teaching Allocations.',
      },
      {
        status:
          403,
      },
    );
  }

  const payload =
    await request
      .json()
      .catch(
        () => null,
      ) as
        | SavePayload
        | null;

  if (
    !payload ||
    !Array.isArray(
      payload.entries,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Online marks are required.',
      },
      {
        status:
          400,
      },
    );
  }

  const entries:
    Array<{
      student_id:
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
    }> = [];

  for (
    const raw of
      payload.entries as
        OnlineEntry[]
  ) {
    if (
      !raw ||
      typeof raw.studentId !==
        'string'
    ) {
      return NextResponse.json(
        {
          message:
            'Every mark row must identify a student.',
        },
        {
          status:
            400,
        },
      );
    }

    const assignment =
      nullableNumber(
        raw.assignment,
      );

    const presentation =
      nullableNumber(
        raw.presentation,
      );

    const rat =
      nullableNumber(
        raw.rat,
      );

    const cat =
      nullableNumber(
        raw.cat,
      );

    const exam =
      nullableNumber(
        raw.exam,
      );

    if (
      assignment ===
        undefined ||
      presentation ===
        undefined ||
      rat ===
        undefined ||
      cat ===
        undefined ||
      exam ===
        undefined
    ) {
      return NextResponse.json(
        {
          message:
            'Marks must be numeric or blank.',
        },
        {
          status:
            400,
        },
      );
    }

    entries.push({
      student_id:
        raw.studentId,
      assignment,
      presentation,
      rat,
      cat,
      exam,
    });
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'save_assessment_online_marks',
      {
        target_assessment_id:
          assessmentId,
        target_entries:
          entries,
      },
    );

  if (error) {
    return NextResponse.json(
      {
        message:
          error.message,
      },
      {
        status:
          error.code ===
          '42501'
            ? 403
            : 409,
      },
    );
  }

  return NextResponse.json({
    success:
      true,
    draft:
      data,
  });
}
