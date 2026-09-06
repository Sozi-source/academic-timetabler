import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { buildStudentUnitRegistrationPdf } from '@/features/student-portal/registration-pdf';
import { getStudentPortalRegistrationContext } from '@/features/student-portal/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pdfMimeType = 'application/pdf';

interface RouteProps {
  params: Promise<{ studentId: string }>;
}

function renderHtmlErrorPage(title: string, message: string, backUrl: string, backLabel: string, status = 404) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Academic Planner</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #F8FAFC; color: #0F172A; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
    .card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 1rem; max-width: 28rem; width: 100%; padding: 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; }
    .icon-box { width: 3.5rem; height: 3.5rem; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; color: #D97706; font-size: 1.5rem; }
    h1 { font-size: 1.125rem; font-weight: 700; color: #033B36; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #64748B; line-height: 1.5; margin-bottom: 1.5rem; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.625rem 1.25rem; background: #033B36; color: #FFFFFF; text-decoration: none; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; transition: background 0.15s ease; }
    .btn:hover { background: #022A26; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">⚠️</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${backUrl}" class="btn">${backLabel}</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request: Request, { params }: RouteProps) {
  const { studentId } = await params;
  const accept = request.headers.get('accept') || '';
  const isHtml = accept.includes('text/html');

  try {
    await requireHodAccess();
  } catch {
    const msg = 'Administrative authorization required to access this student document.';
    return isHtml
      ? renderHtmlErrorPage('Access Denied', msg, `/students/registry/${studentId}`, 'Back to Student Record', 401)
      : NextResponse.json({ message: msg }, { status: 401 });
  }

  const context = await getStudentPortalRegistrationContext(studentId);

  if (!context || !context.period || !context.units.some((unit) => unit.registrationStatus === 'registered')) {
    const msg = 'No active prefilled unit registration document is available for this student yet. Ensure cohort units have been registered by the HOD.';
    return isHtml
      ? renderHtmlErrorPage('Registration Form Unavailable', msg, `/students/registry/${studentId}`, 'Back to Student Record', 404)
      : NextResponse.json({ message: msg }, { status: 404 });
  }

  const document = await buildStudentUnitRegistrationPdf(context);
  const filename = `${context.student.admissionNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')} Unit Registration.pdf`;

  return new NextResponse(new Uint8Array(document), {
    headers: {
      'Content-Type': pdfMimeType,
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
