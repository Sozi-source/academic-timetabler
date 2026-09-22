import { redirect } from 'next/navigation';

import { StudentPortalShell } from '@/components/student/student-portal-shell';
import { Badge } from '@/components/ui/badge';
import { getStudentPortalAttendance } from '@/features/attendance-analytics/queries';
import { getStudentPortalIdentity } from '@/features/student-portal/queries';
import { getStudentPortalSession } from '@/features/student-portal/session';
import { StudentAttendanceView } from '@/features/student-portal/student-attendance-view';

export default async function StudentAttendancePage() {
  const session = await getStudentPortalSession();

  if (!session) {
    redirect('/student/login');
  }

  const [student, attendance] = await Promise.all([
    getStudentPortalIdentity(session.studentId),
    getStudentPortalAttendance(session.studentId),
  ]);

  if (!student) {
    redirect('/student/login');
  }

  return (
    <StudentPortalShell student={student}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-xl font-bold text-text-primary">
              Class Attendance
            </h1>
            <p className="mt-0.5 text-xs text-text-muted">
              {attendance.periodName ?? 'No active academic period'}
            </p>
          </div>

          <Badge variant="neutral">
            {attendance.completedSessions} session{attendance.completedSessions === 1 ? '' : 's'} recorded
          </Badge>
        </div>

        <StudentAttendanceView attendance={attendance} />
      </div>
    </StudentPortalShell>
  );
}
