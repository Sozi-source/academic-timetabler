import {
  ArrowLeft,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { StudentPortalAccessManager } from '@/features/student-access/access-manager';
import { studentPortalAccessSummary } from '@/features/student-access/domain';
import { getStudentPortalAccessRegister } from '@/features/student-access/queries';

export default async function StudentPortalAccessPage() {
  await requireHodAccess();

  const rows = await getStudentPortalAccessRegister();
  const summary = studentPortalAccessSummary(rows);

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Student Portal Access & PINs"
        description="Issue, view, and rotate student portal authentication PINs."
        icon={KeyRound}
        actions={
          <Link
            href="/students"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <ArrowLeft className="size-3.5 text-slate-500" />
            <span>Students Hub</span>
          </Link>
        }
      />

      {/* Summary Telemetry Strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <UsersRound className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Eligible Students
            </p>
            <p className="text-sm font-bold text-slate-900">
              {summary.eligible}
            </p>
            <p className="text-[11px] text-slate-500">Active enrollments</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <UserCheck className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              PINs Issued
            </p>
            <p className="text-sm font-bold text-slate-900">
              {summary.issued} / {summary.eligible}
            </p>
            <p className="text-[11px] text-slate-500">{summary.notIssued} not issued</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Access
            </p>
            <p className="text-sm font-bold text-slate-900">
              {summary.active} Active
            </p>
            <p className="text-[11px] text-slate-500">{summary.disabled} disabled</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <LockKeyhole className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Locked Accounts
            </p>
            <p className="text-sm font-bold text-slate-900">
              {summary.locked}
            </p>
            <p className="text-[11px] text-slate-500">{summary.neverSignedIn} never signed in</p>
          </div>
        </div>
      </section>

      <StudentPortalAccessManager rows={rows} />
    </div>
  );
}
