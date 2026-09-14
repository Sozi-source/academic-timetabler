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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="border-b border-border bg-surface-subtle/60 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 w-[28%]">Trainer</th>
                  <th scope="col" className="px-4 py-3 w-[32%]">Workspace Details</th>
                  <th scope="col" className="px-4 py-3 w-[16%]">Access Status</th>
                  <th scope="col" className="px-4 py-3 w-[24%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => (
                  <tr
                    key={record.trainerId}
                    className="transition hover:bg-surface-subtle/40"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <Link
                        href={`/trainers/${record.trainerId}`}
                        className="truncate text-xs font-semibold text-text-primary transition hover:text-header-blue hover:underline block"
                      >
                        {record.fullName}
                      </Link>
                      <p className="mt-0.5 truncate text-[10px] text-text-muted">
                        {record.email ?? 'No email'}
                      </p>
                    </td>

                    <td className="px-4 py-3.5 align-middle">
                      <p className="text-[11px] font-medium text-text-secondary">
                        {trainerAccessDetail(record)}
                      </p>
                      {record.profileRole ? (
                        <p className="mt-0.5 text-[10px] text-text-muted">
                          Profile: {record.profileRole}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                      <Badge
                        variant={
                          record.accessState === 'linked'
                            ? 'success'
                            : record.accessState === 'ready_to_link'
                              ? 'primary'
                              : 'neutral'
                        }
                        className="inline-flex items-center gap-1"
                      >
                        {record.accessState === 'linked' ? (
                          <CheckCircle2 className="size-3 text-emerald-600" aria-hidden="true" />
                        ) : null}
                        {record.accessState === 'linked' ? 'Active' : trainerAccessLabel(record.accessState)}
                      </Badge>
                    </td>

                    <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        {canProvisionTrainerAccess(record.accessState) ? (
                          <TrainerAccessAction trainerId={record.trainerId} />
                        ) : record.accessState === 'email_required' ? (
                          <Link
                            href={`/timetable/trainers/${record.trainerId}/edit`}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-white px-2.5 text-[11px] font-semibold text-header-blue transition hover:bg-surface-subtle shadow-2xs"
                          >
                            Add email
                          </Link>
                        ) : null}

                        <Link
                          href={`/trainers/${record.trainerId}`}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-medium text-text-secondary transition hover:bg-surface-subtle shadow-2xs"
                        >
                          Profile
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
