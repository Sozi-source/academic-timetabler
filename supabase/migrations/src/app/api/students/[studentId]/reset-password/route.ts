import { NextRequest } from 'next/server';

import { POST as adminStudentResetPOST } from '@/app/api/admin/students/[id]/reset-password/route';

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ studentId: string }>;
  },
) {
  const { studentId } = await params;
  return adminStudentResetPOST(request, {
    params: Promise.resolve({ id: studentId }),
  });
}
