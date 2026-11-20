import {
  KeyRound,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
} from '@/components/ui/badge';
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
  summarizeTrainerAccess,
} from '@/features/trainer-access/domain';
import {
  getTrainerAccessRegister,
} from '@/features/trainer-access/queries';
import { TrainerAccessTable } from '@/features/trainer-access/trainer-access-table';
import { TrainerAccessBulkPinAction } from '@/features/trainer-access/trainer-access-bulk-pin-action';

export default async function TrainerAccessPage() {
  await requireHodAccess();

  const records =
    await getTrainerAccessRegister();

  const summary =
    summarizeTrainerAccess(
      records,
    );
  const bulkPinTrainers = records.flatMap((record) => (
    record.trainerActive
      && record.email
      && record.profileRole !== 'hod'
      && record.profileRole !== 'system_admin'
      ? [{ trainerId: record.trainerId, fullName: record.fullName, email: record.email }]
      : []
  ));

  return (
    <div className="trainer-access-screen mx-auto w-full max-w-[96rem] space-y-5 lg:space-y-6">
      <PageHeader
        title="Trainer Access"
        icon={KeyRound}
        backHref="/trainers"
        backLabel="Staff & Trainers"
      />

      <section className="grid gap-3 sm:grid-cols-3 lg:gap-4">
        <MetricCard
          label="Linked"
          value={String(
            summary.linked,
          )}
          description="Staff workspace enabled"
          icon={UserCheck}
          status="Active"
        />

        <MetricCard
          label="Ready"
          value={String(
            summary.ready,
          )}
          description="Matching account found"
          icon={KeyRound}
          status="Link"
        />

        <MetricCard
          label="Account required"
          value={String(
            summary.accountRequired,
          )}
          description="Trainer registration pending"
          icon={UserPlus}
          status="Pending"
        />
      </section>

      <section className="trainer-access-register overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 lg:px-6 lg:py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary lg:text-base">
              Access register
            </h2>

          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="neutral">
              {
                summary.total
              } trainers
            </Badge>

            <Link
              href="/staff/register"
              className="text-xs font-semibold text-header-blue hover:underline"
            >
              Staff registration
            </Link>
          </div>
        </div>

        <TrainerAccessBulkPinAction trainers={bulkPinTrainers} />

        <TrainerAccessTable records={records} />
      </section>
    </div>
  );
}
