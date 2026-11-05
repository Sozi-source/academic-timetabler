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
      ? [{ trainerId: record.trainerId, fullName: record.fullName, email: record.email }]
      : []
  ));

  return (
    <div className="admin-screen trainer-access-screen space-y-5">
      <PageHeader
        title="Trainer Access"
        icon={KeyRound}
        backHref="/trainers"
        backLabel="Staff & Trainers"
      />

      <section className="grid gap-3 sm:grid-cols-3">
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Access register
            </h2>

            <p className="mt-0.5 text-[11px] text-text-muted">
              Link trainer accounts and generate one time shareable PINs for the external trainer portal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {
                summary.total
              } trainers
            </Badge>

            <Link
              href="/staff/register"
              className="text-[11px] font-semibold text-header-blue hover:underline"
            >
              Staff registration
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border bg-surface-subtle/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold text-text-primary">Bulk PIN generation</h3>
            <p className="mt-1 max-w-2xl text-[11px] leading-4 text-text-muted">
              Generate or replace PINs for all active trainers across the app with an email address. Existing PINs will stop working.
            </p>
          </div>
          <div className="w-full min-w-0 sm:w-auto sm:shrink-0">
            <TrainerAccessBulkPinAction trainers={bulkPinTrainers} />
          </div>
        </div>

        <TrainerAccessTable records={records} />
      </section>
    </div>
  );
}
