import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  UserCheck,
  UserPlus,
  Users,
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
  canProvisionTrainerAccess,
  summarizeTrainerAccess,
  trainerAccessDetail,
  trainerAccessLabel,
} from '@/features/trainer-access/domain';
import {
  getTrainerAccessRegister,
} from '@/features/trainer-access/queries';
import {
  TrainerAccessAction,
} from '@/features/trainer-access/trainer-access-action';

export default async function TrainerAccessPage() {
  await requireHodAccess();

  const records =
    await getTrainerAccessRegister();

  const summary =
    summarizeTrainerAccess(
      records,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Trainers"
        title="Staff Access"
        description="Link registered trainers to their secure staff workspace."
        icon={KeyRound}
        actions={
          <Link
            href="/timetable/trainers"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            Trainers
          </Link>
        }
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

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Access register
            </h2>

            <p className="mt-0.5 text-[11px] text-text-muted">
              Trainers use their registered
              email to create an account.
            </p>
          </div>

          <div className="flex items-center gap-2">
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

        {records.length ===
        0 ? (
          <div className="px-5 py-10 text-center">
            <Users
              className="mx-auto size-5 text-text-muted"
              aria-hidden="true"
            />
            <p className="mt-3 text-xs font-semibold text-text-primary">
              No trainers found
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {records.map(
              (
                record,
              ) => (
                <article
                  key={
                    record.trainerId
                  }
                  className="grid gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_10rem_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/trainers/${record.trainerId}`}
                      className="truncate text-xs font-semibold text-text-primary transition hover:text-header-blue hover:underline block"
                    >
                      {record.fullName}
                    </Link>

                    <p className="mt-0.5 truncate text-[10px] text-text-muted">
                      {record.email ?? 'No email'}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-text-secondary">
                      {trainerAccessDetail(record)}
                    </p>

                    {record.profileRole ? (
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        Profile: {record.profileRole}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <Badge
                      variant={
                        record.accessState === 'linked'
                          ? 'success'
                          : record.accessState === 'ready_to_link'
                            ? 'primary'
                            : 'neutral'
                      }
                    >
                      {trainerAccessLabel(record.accessState)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 md:justify-self-end">
                    {canProvisionTrainerAccess(record.accessState) ? (
                      <TrainerAccessAction trainerId={record.trainerId} />
                    ) : record.accessState === 'linked' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        Approved
                      </span>
                    ) : record.accessState === 'email_required' ? (
                      <Link
                        href={`/timetable/trainers/${record.trainerId}/edit`}
                        className="text-[11px] font-semibold text-header-blue hover:underline"
                      >
                        Add email
                      </Link>
                    ) : (
                      <span className="text-[10px] font-medium text-text-muted">
                        Pending registration
                      </span>
                    )}

                    <Link
                      href={`/trainers/${record.trainerId}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-medium text-text-secondary transition hover:bg-surface-subtle"
                    >
                      Profile
                    </Link>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
