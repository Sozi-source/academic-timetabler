import { requireHodAccess } from '@/features/auth/authorization';
import { createQaExaminationPack } from '@/features/teaching-documents/qa-export';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return Response.json(
      { message: 'Select an active department before exporting QA documents.' },
      { status: 400 },
    );
  }

  const academicPeriodId = new URL(request.url).searchParams.get('academicPeriodId')?.trim();
  if (!academicPeriodId) {
    return Response.json({ message: 'Choose an academic period for the QA export.' }, { status: 400 });
  }

  try {
    const pack = await createQaExaminationPack(
      academicPeriodId,
      profile.activeDepartmentId,
      profile.departmentName,
    );
    return new Response(new Uint8Array(pack.archive), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(pack.fileName)}"`,
        'Content-Length': String(pack.archive.length),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-QA-Included-Documents': String(pack.includedDocuments),
        'X-QA-Unavailable-Documents': String(pack.unavailableDocuments),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create the QA examination pack.';
    return Response.json({ message }, { status: 422 });
  }
}
