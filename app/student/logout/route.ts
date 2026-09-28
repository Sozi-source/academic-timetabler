import { NextResponse, type NextRequest } from 'next/server';
import { revokeStudentPortalSession } from '@/features/student-portal/session';

export async function GET(request: NextRequest) {
  await revokeStudentPortalSession();
  const url = new URL('/student/login', request.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete('ams_student_session');
  return response;
}
