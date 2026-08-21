import {
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  StudentPortalAccessManager,
} from '@/features/student-access/access-manager';
import {
  studentPortalAccessSummary,
} from '@/features/student-access/domain';
import {
  getStudentPortalAccessRegister,
} from '@/features/student-access/queries';

export default async function StudentPortalAccessPage() {
  await requireHodAccess();

  const rows =
    await getStudentPortalAccessRegister();

  const summary =
    studentPortalAccessSummary(
      rows,
    );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Student Lifecycle"
        title="Student access"
        description="Issue and manage student portal PINs."
        icon={KeyRound}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Eligible"
          value={String(
            summary.eligible,
          )}
          description="Active / admitted"
          icon={UsersRound}
        />

        <MetricCard
          label="Access issued"
          value={String(
            summary.issued,
          )}
          description={`${summary.notIssued} not issued`}
          icon={UserRoundCheck}
        />

        <MetricCard
          label="Active access"
          value={String(
            summary.active,
          )}
          description={`${summary.disabled} disabled`}
          icon={ShieldCheck}
        />

        <MetricCard
          label="Locked"
          value={String(
            summary.locked,
          )}
          description={`${summary.neverSignedIn} never signed in`}
          icon={LockKeyhole}
        />
      </section>

      <StudentPortalAccessManager
        rows={
          rows
        }
      />
    </div>
  );
}
