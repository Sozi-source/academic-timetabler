import { redirect } from 'next/navigation';

import { getStudentPortalSession } from '@/features/student-portal/session';

export default async function StudentPortalPage() {
  const session = await getStudentPortalSession();
  redirect(session ? '/student/unit-registration' : '/student/login');
}
