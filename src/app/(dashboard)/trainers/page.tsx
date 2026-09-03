import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  KeyRound,
  Plus,
  ShieldCheck,
  Upload,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrudModal } from '@/components/ui/crud-modal';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getWorkingDepartments } from '@/features/organization/queries';
import {
  canProvisionTrainerAccess,
  summarizeTrainerAccess,
  trainerAccessDetail,
  trainerAccessLabel,
} from '@/features/trainer-access/domain';
import { getTrainerAccessRegister } from '@/features/trainer-access/queries';
import { TrainerAccessAction } from '@/features/trainer-access/trainer-access-action';
import { CreateTrainerForm } from '@/features/trainers/create-trainer-form';
import { getTrainers } from '@/features/trainers/queries';
import { ResetTrainerPassword } from '@/features/trainers/reset-trainer-password';
import { TrainerTable } from '@/features/trainers/trainer-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Staff & Trainer Management | Academic Planning System',
  description: 'Manage departmental trainers, staff workspace access, account approvals, and scheduling availability.',
};

export default async function StaffManagementPage() {
  await requireHodAccess();

  const [trainers, departments, accessRecords] = await Promise.all([
    getTrainers(),
    getWorkingDepartments(),
    getTrainerAccessRegister(),
  ]);

  const availableTrainers = trainers.filter(
    (trainer) => trainer.isActive && trainer.isTimetableAvailable,
  );

  const summary = summarizeTrainerAccess(accessRecords);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Institutional Personnel"
        title="Staff & Trainer Management"
        description="Manage trainer directory, workload allocations, staff workspace access, and account approvals."
        icon={Users}
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/trainers/availability">
                <CalendarCheck className="size-4" aria-hidden="true" />
                Availability
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/trainers/import">
                <Upload className="size-4" aria-hidden="true" />
                Import Excel
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/staff/register">
                <UserPlus className="size-4" aria-hidden="true" />
                Staff Register
              </Link>
            </Button>
            <CrudModal
              title="Add New Trainer"
              triggerLabel="Add Trainer"
              widthClassName="max-w-2xl"
            >
              <CreateTrainerForm departments={departments} />
            </CrudModal>
          </div>
        }
      />

      {/* 1. Standardized Metric Telemetry Strip */}
      <section aria-label="Staff Overview Metrics" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-xs transition hover:border-[#033B36]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Total Trainers
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#033B36]/10 text-[#033B36]">
              <Users className="size-4 text-[#033B36]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-gray-900 tracking-tight">
              {trainers.length}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Department teaching register</p>
          </div>
          <div className="mt-3 h-0.5 w-7 rounded-full bg-[#033B36]" />
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-xs transition hover:border-[#F59E0B]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Timetable Available
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B]/15 text-[#D97706]">
              <UserCheck className="size-4 text-[#D97706]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-gray-900 tracking-tight">
              {availableTrainers.length}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Eligible for lesson slots</p>
          </div>
          <div className="mt-3 h-0.5 w-7 rounded-full bg-[#F59E0B]" />
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-xs transition hover:border-[#033B36]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Workspaces Linked
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#033B36]/10 text-[#033B36]">
              <KeyRound className="size-4 text-[#033B36]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-gray-900 tracking-tight">
              {summary.linked}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Staff portal authenticated</p>
          </div>
          <div className="mt-3 h-0.5 w-7 rounded-full bg-[#033B36]" />
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 shadow-xs transition hover:border-[#15803D]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Pending Setup
            </span>
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Clock className="size-4 text-amber-600" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-gray-900 tracking-tight">
              {summary.ready + summary.accountRequired}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {summary.ready} ready · {summary.accountRequired} pending
            </p>
          </div>
          <div className="mt-3 h-0.5 w-7 rounded-full bg-amber-500" />
        </div>
      </section>

      {/* 2. Workspace Access & Account Approvals Panel */}
      <section aria-labelledby="access-approvals-heading" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#033B36]/10 text-[#033B36]">
              <KeyRound className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="access-approvals-heading" className="text-sm font-bold text-gray-900">
                Staff Workspace Access & Account Approvals
              </h2>
              <p className="text-xs text-gray-500">
                Link and approve registered trainers to access their personal staff workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              {accessRecords.length} accounts recorded
            </Badge>
          </div>
        </div>

        {accessRecords.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Users className="mx-auto size-6 text-gray-400" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold text-gray-900">No trainer records found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {accessRecords.map((record) => (
              <article
                key={record.trainerId}
                className="grid gap-3 px-5 py-3.5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_9rem_auto] md:items-center transition hover:bg-gray-50/50"
              >
                <div className="min-w-0">
                  <Link
                    href={`/trainers/${record.trainerId}`}
                    className="truncate text-xs font-bold text-gray-900 transition hover:text-[#033B36] hover:underline block"
                  >
                    {record.fullName}
                  </Link>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">
                    {record.email ?? 'No email specified'}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700">
                    {trainerAccessDetail(record)}
                  </p>
                  {record.profileRole ? (
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      Profile Role: <span className="font-semibold text-gray-600">{record.profileRole}</span>
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

                <div className="flex flex-wrap items-center gap-2 md:justify-self-end">
                  {canProvisionTrainerAccess(record.accessState) ? (
                    <TrainerAccessAction trainerId={record.trainerId} />
                  ) : record.accessState === 'linked' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 mr-1">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      Active
                    </span>
                  ) : record.accessState === 'email_required' ? (
                    <Link
                      href={`/timetable/trainers/${record.trainerId}/edit`}
                      className="text-xs font-semibold text-[#033B36] hover:underline"
                    >
                      Add email
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400 italic">
                      Awaiting setup
                    </span>
                  )}

                  {record.email ? (
                    <ResetTrainerPassword
                      trainerId={record.trainerId}
                      trainerName={record.fullName}
                      trainerEmail={record.email}
                      buttonVariant="outline"
                      buttonSize="sm"
                      buttonLabel="Password"
                    />
                  ) : null}

                  <Link
                    href={`/trainers/${record.trainerId}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-300"
                  >
                    Profile
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 3. Master Trainer Directory & Workload Table */}
      <section aria-labelledby="trainer-directory-heading" className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 id="trainer-directory-heading" className="text-sm font-bold uppercase tracking-wider text-gray-700">
            Teaching Staff Directory
          </h2>
          <span className="text-xs text-gray-500 font-medium">{trainers.length} Registered Trainers</span>
        </div>

        <TrainerTable trainers={trainers} />
      </section>
    </div>
  );
}
