import { NextResponse } from 'next/server';
import { requireHodAccess } from '@/features/auth/authorization';
import { generateCurriculumContentTemplate } from '@/features/teaching-documents/curriculum-content/workbook';

export async function GET() {
  await requireHodAccess();
  const buffer = await generateCurriculumContentTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="academic-planner-curriculum-content-template-v1.xlsx"',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
