import { NextResponse } from 'next/server';
import { requireHodAccess } from '@/features/auth/authorization';
import { generateCourseOutlineImportTemplate } from '@/features/teaching-documents/curriculum-content/workbook';

export async function GET() {
  await requireHodAccess();
  const buffer = await generateCourseOutlineImportTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Academic_Planner_Course_Outline_Import_Template.xlsx"',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
