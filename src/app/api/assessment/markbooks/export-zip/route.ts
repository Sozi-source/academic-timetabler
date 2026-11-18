import { requireHodAccess } from '@/features/auth/authorization';
import {
  createAssessmentMarksheetsZip,
  type MarksheetsZipType,
} from '@/features/assessment/reports/marksheets-zip-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseZipType(raw: string | null): MarksheetsZipType {
  if (raw === 'cat' || raw === 'final' || raw === 'both') return raw;
  return 'both';
}

export async function GET(request: Request): Promise<Response> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return Response.json(
      { message: 'Select an active department before exporting marksheets.' },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const academicPeriodId = url.searchParams.get('academicPeriodId')?.trim();
  if (!academicPeriodId) {
    return Response.json(
      { message: 'Choose an academic period for the marksheets export.' },
      { status: 400 },
    );
  }

  const type = parseZipType(url.searchParams.get('type')?.trim() ?? null);

  try {
    const pack = await createAssessmentMarksheetsZip({
      academicPeriodId,
      departmentId: profile.activeDepartmentId,
      departmentName: profile.departmentName,
      type,
    });

    return new Response(new Uint8Array(pack.archive), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(pack.fileName)}"`,
        'Content-Length': String(pack.archive.length),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Marksheets-Included': String(pack.includedMarksheets),
        'X-Marksheets-Skipped': String(pack.skippedMarksheets),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create the marksheets ZIP archive.';
    return Response.json({ message }, { status: 422 });
  }
}
