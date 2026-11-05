import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CalendarCheck,
  Clock,
  KeyRound,
  Upload,
  UserCheck,
  UserPlus,
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
  summarizeTrainerAccess,
} from '@/features/trainer-access/domain';
import { getTrainerAccessRegister } from '@/features/trainer-access/queries';
import { TrainerAccessTable } from '@/features/trainer-access/trainer-access-table';
import { CreateTrainerForm } from '@/features/trainers/create-trainer-form';
import { getTrainers } from '@/features/trainers/queries';
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
    <div className="trainer-management-screen space-y-7">
      <PageHeader
        eyebrow="Institutional Personnel"
        title="Staff & Trainer Management"
        icon={Users}
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/timetable/trainers/availability">
                <CalendarCheck className="size-4" aria-hidden="true" />
                Availability
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/trainers/access">
                <KeyRound className="size-4" aria-hidden="true" />
                Trainer Access
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
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

      {/* 1. Standardized Metric Telemetry Strip: 2x2 on mobile, 4-col on desktop */}
      <section aria-label="Staff Overview Metrics" className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border border-border/90 bg-white p-3 sm:p-4 shadow-xs transition hover:border-[#033B36]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Total Trainers
            </span>
            <span className="flex size-7 sm:size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#033B36]/10 text-primary-deep">
              <Users className="size-3.5 sm:size-4 text-primary-deep" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
              {trainers.length}
            </p>
            <p className="truncate text-[10px] sm:text-[11px] text-text-muted mt-0.5">Teaching register</p>
          </div>
          <div className="mt-2 sm:mt-3 h-0.5 w-7 rounded-full bg-[#033B36]" />
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-border/90 bg-white p-3 sm:p-4 shadow-xs transition hover:border-[#F59E0B]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Timetable Available
            </span>
            <span className="flex size-7 sm:size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B]/15 text-[#D97706]">
              <UserCheck className="size-3.5 sm:size-4 text-[#D97706]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
              {availableTrainers.length}
            </p>
            <p className="truncate text-[10px] sm:text-[11px] text-text-muted mt-0.5">Eligible for slots</p>
          </div>
          <div className="mt-2 sm:mt-3 h-0.5 w-7 rounded-full bg-[#F59E0B]" />
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-border/90 bg-white p-3 sm:p-4 shadow-xs transition hover:border-[#033B36]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Workspaces Linked
            </span>
            <span className="flex size-7 sm:size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#033B36]/10 text-primary-deep">
              <KeyRound className="size-3.5 sm:size-4 text-primary-deep" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
              {summary.linked}
            </p>
            <p className="truncate text-[10px] sm:text-[11px] text-text-muted mt-0.5">Portal authenticated</p>
          </div>
          <div className="mt-2 sm:mt-3 h-0.5 w-7 rounded-full bg-[#033B36]" />
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-border/90 bg-white p-3 sm:p-4 shadow-xs transition hover:border-[#15803D]/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Pending Setup
            </span>
            <span className="flex size-7 sm:size-7.5 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Clock className="size-3.5 sm:size-4 text-amber-600" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
              {summary.ready + summary.accountRequired}
            </p>
            <p className="truncate text-[10px] sm:text-[11px] text-text-muted mt-0.5">
              {summary.ready} ready · {summary.accountRequired} pending
            </p>
          </div>
          <div className="mt-2 sm:mt-3 h-0.5 w-7 rounded-full bg-amber-500" />
        </div>
      </section>

      {/* 2. Workspace Access & Account Approvals Panel */}
      <section aria-labelledby="access-approvals-heading" className="trainer-approvals-register overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft bg-surface-subtle/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#033B36]/10 text-primary-deep">
              <KeyRound className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="access-approvals-heading" className="text-sm font-bold text-text-primary">
                Staff Workspace Access & Account Approvals
              </h2>
              <p className="text-xs text-text-muted">
                Link and approve registered trainers to access their personal staff workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {accessRecords.length} accounts recorded
            </Badge>
          </div>
        </div>

        <TrainerAccessTable
          records={accessRecords}
          variant="password"
          exportFileName="staff-access-register"
        />
      </section>

      {/* 3. Master Trainer Directory & Workload Table */}
      <section aria-labelledby="trainer-directory-heading" className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="trainer-directory-heading" className="text-sm font-bold uppercase tracking-wider text-text-secondary">
            Teaching Staff Directory
          </h2>
          <span className="text-xs text-text-muted font-medium">{trainers.length} Registered Trainers</span>
        </div>

        <TrainerTable trainers={trainers} />
      </section>
    </div>
  );
}
