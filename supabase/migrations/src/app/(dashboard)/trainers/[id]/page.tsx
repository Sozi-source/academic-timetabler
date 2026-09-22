import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  CircleOff,
  Clock,
  Eye,
  GraduationCap,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Plus,
  Presentation,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { requireHodAccess } from '@/features/auth/authorization';
import { getTrainerAccessRegister } from '@/features/trainer-access/queries';
import { TrainerAccessAction } from '@/features/trainer-access/trainer-access-action';
import {
  setTrainerActiveAction,
  setTrainerTimetableAvailabilityAction,
} from '@/features/trainers/actions';
import { ResetTrainerPassword } from '@/features/trainers/reset-trainer-password';
import {
  getTrainerAllocations,
  getTrainerById,
} from '@/features/trainers/queries';

export const dynamic = 'force-dynamic';

interface TrainerDetailsPageProps {
  params: Promise<{ id: string }>;
}

function formatWorkloadRole(role: string): string {
  switch (role) {
    case 'hod':
      return 'Head of Department (HOD)';
    case 'course_coordinator':
      return 'Course Coordinator';
    case 'full_time_trainer':
      return 'Full-time Trainer';
    case 'part_time':
      return 'Part-time Trainer';
    case 'external':
      return 'External / Service Trainer';
    default:
      return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatEmploymentType(type: string): string {
  switch (type) {
    case 'full_time':
      return 'Full-Time';
    case 'part_time':
      return 'Part-Time';
    case 'contract':
      return 'Contract';
    case 'visiting':
      return 'Visiting';
    case 'other':
      return 'Other';
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function generateMetadata({
  params,
}: TrainerDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  const trainer = await getTrainerById(id);

  return {
    title: trainer
      ? `${trainer.fullName} - Staff Profile | Academic Planning System`
      : 'Trainer Not Found',
    description: 'Detailed trainer profile, workspace access status, and teaching allocations.',
  };
}

export default async function TrainerDetailsPage({
  params,
}: TrainerDetailsPageProps) {
  await requireHodAccess();
  const { id } = await params;

  const [trainer, accessRecords, allocations] = await Promise.all([
    getTrainerById(id),
    getTrainerAccessRegister(),
    getTrainerAllocations(id),
  ]);

  if (!trainer) {
    notFound();
  }

  const accessRecord = accessRecords.find(
    (record) => record.trainerId === trainer.id,
  );

  const accessState =
    accessRecord?.accessState ??
    (trainer.email ? 'account_required' : 'email_required');

  const totalAllocatedHours = allocations.reduce(
    (total, item) => total + item.weeklyHours,
    0,
  );

  const targetHours = trainer.normalWeeklyHours || 20;
  const utilizationPercentage = Math.round((totalAllocatedHours / targetHours) * 100);

  return (
    <div className="space-y-4">
      {/* 1. Executive Top Navigation & Management Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/trainers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
        >
          <ArrowLeft className="size-3.5" />
          Staff Directory
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          {accessState === 'ready_to_link' && (
            <TrainerAccessAction trainerId={trainer.id} />
          )}

          <Button
            asChild
            variant="primary"
            size="sm"
            className="bg-[#033B36] text-white hover:bg-[#022A26] shadow-2xs h-8 text-xs font-semibold"
          >
            <Link href={`/trainers/${trainer.id}/portal-view`}>
              <Eye className="size-3.5 mr-1.5" aria-hidden="true" />
              Staff Portal
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold">
            <Link href={`/timetable/trainers/${trainer.id}/edit`}>
              <Pencil className="size-3.5 mr-1.5" aria-hidden="true" />
              Edit Profile
            </Link>
          </Button>

          {/* Timetable Availability Action */}
          {trainer.isActive ? (
            <form action={setTrainerTimetableAvailabilityAction}>
              <input type="hidden" name="id" value={trainer.id} />
              <input
                type="hidden"
                name="isTimetableAvailable"
                value={trainer.isTimetableAvailable ? 'false' : 'true'}
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className={`h-8 text-xs font-semibold ${
                  trainer.isTimetableAvailable
                    ? 'text-gray-700 hover:text-amber-800'
                    : 'text-emerald-700 border-emerald-300 bg-emerald-50/60'
                }`}
                title={trainer.isTimetableAvailable ? 'Mark unavailable for timetabling' : 'Make available for timetabling'}
              >
                {trainer.isTimetableAvailable ? (
                  <>
                    <CalendarX2 className="size-3.5 mr-1.5 text-gray-400" aria-hidden="true" />
                    Disable Timetable
                  </>
                ) : (
                  <>
                    <CalendarCheck2 className="size-3.5 mr-1.5 text-emerald-600" aria-hidden="true" />
                    Enable Timetable
                  </>
                )}
              </Button>
            </form>
          ) : null}

          {/* Active / Deactivate Action */}
          <form action={setTrainerActiveAction}>
            <input type="hidden" name="id" value={trainer.id} />
            <input type="hidden" name="isActive" value={trainer.isActive ? 'false' : 'true'} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className={`h-8 text-xs font-semibold ${
                trainer.isActive
                  ? 'text-gray-700 hover:text-rose-700 hover:border-rose-200'
                  : 'text-emerald-700 border-emerald-300 bg-emerald-50/60'
              }`}
              title={trainer.isActive ? 'Deactivate trainer record' : 'Activate trainer record'}
            >
              {trainer.isActive ? (
                <>
                  <CircleOff className="size-3.5 mr-1.5 text-rose-500" aria-hidden="true" />
                  Deactivate
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5 text-emerald-600" aria-hidden="true" />
                  Activate
                </>
              )}
            </Button>
          </form>

          {trainer.email ? (
            <ResetTrainerPassword
              trainerId={trainer.id}
              trainerName={trainer.fullName}
              trainerEmail={trainer.email}
              buttonVariant="outline"
              buttonSize="sm"
              buttonLabel="Password"
            />
          ) : null}
        </div>
      </div>

      {/* 2. Compact Executive Hero Card */}
      <section
        aria-label="Trainer Profile Overview"
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#033B36] text-sm font-bold text-white shadow-2xs">
              {getInitials(trainer.fullName)}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                  {trainer.fullName}
                </h1>
                {trainer.staffNumber && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-700">
                    {trainer.staffNumber}
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500">
                <span>{formatWorkloadRole(trainer.workloadRole)}</span>
                <span className="mx-1.5 text-gray-300">·</span>
                <span>{trainer.homeDepartment || 'Human Nutrition & Dietetics'}</span>
              </p>

              {/* Status Badges Row */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                    trainer.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      trainer.isActive ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  />
                  {trainer.isActive ? 'Active' : 'Inactive'}
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                    trainer.isTimetableAvailable
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      trainer.isTimetableAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {trainer.isTimetableAvailable ? 'Timetable Available' : 'Timetable Unavailable'}
                </span>

                {accessState === 'linked' ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/70">
                    <CheckCircle2 className="size-2.5 text-emerald-600" />
                    Portal Active
                  </span>
                ) : accessState === 'ready_to_link' ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                    <KeyRound className="size-2.5 text-amber-600" />
                    Link Ready
                  </span>
                ) : accessState === 'account_required' ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600 border border-gray-200">
                    <Clock className="size-2.5 text-gray-400" />
                    Pending Signup
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                    <AlertCircle className="size-2.5 text-rose-600" />
                    Email Required
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Compact Workload Gauge */}
          <div className="flex flex-col gap-1.5 rounded-xl border border-gray-100 bg-gray-50/80 p-3 lg:min-w-[240px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600">Weekly Workload</span>
              <span className="font-bold text-gray-900 font-mono">
                {totalAllocatedHours} / {targetHours} hrs
              </span>
            </div>

            <Progress
              value={utilizationPercentage}
              max={100}
              className="h-1.5 bg-gray-200"
              indicatorClassName={
                utilizationPercentage > 100
                  ? 'bg-amber-600'
                  : utilizationPercentage >= 75
                  ? 'bg-[#033B36]'
                  : 'bg-emerald-600'
              }
            />

            <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
              <span>{utilizationPercentage}% Allocated</span>
              <span>Max {trainer.maximumDailyHours}h/day</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Content: Allocations & Details */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Approved Teaching Allocations (col-span-8) */}
        <div className="space-y-4 lg:col-span-8">
          <section
            aria-labelledby="teaching-allocations-heading"
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h2
                  id="teaching-allocations-heading"
                  className="text-xs font-bold uppercase tracking-wider text-gray-900"
                >
                  Teaching Allocations
                </h2>
                <span className="rounded-full bg-gray-200/80 px-2 py-0.2 text-[10px] font-bold text-gray-700">
                  {allocations.length}
                </span>
              </div>

              <Link
                href="/timetable/teaching-allocations"
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 shadow-2xs transition hover:bg-gray-50"
              >
                <Plus className="size-3 text-gray-500" />
                Assign Unit
              </Link>
            </div>

            {allocations.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-gray-500">
                No units currently assigned to this trainer.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {allocations.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition hover:bg-gray-50/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#033B36]">
                          {item.unitCode}
                        </span>
                        <span className="text-xs font-semibold text-gray-900 truncate">
                          {item.unitName}
                        </span>
                        {item.deliveryMode &&
                          item.deliveryMode.toLowerCase() !== 'theory' && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[9px] font-semibold uppercase text-amber-700 border border-amber-200">
                              {item.deliveryMode}
                            </span>
                          )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {item.cohortName} · {item.cohortSize} students
                      </p>
                    </div>

                    <div className="flex items-center gap-4 sm:shrink-0 text-right">
                      <span className="font-mono text-xs font-bold text-gray-900">
                        {item.weeklyHours}h / wk
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {item.weeklySessions} session{item.weeklySessions === 1 ? '' : 's'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Credentials & Administrative Information (col-span-4) */}
        <div className="space-y-4 lg:col-span-4">
          <section
            aria-labelledby="contact-credentials-heading"
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs space-y-3"
          >
            <h2
              id="contact-credentials-heading"
              className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2"
            >
              Staff Profile Details
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-0.5">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-gray-400" />
                  Email
                </span>
                {trainer.email ? (
                  <a
                    href={`mailto:${trainer.email}`}
                    className="font-semibold text-gray-900 hover:text-[#033B36] hover:underline truncate max-w-[180px]"
                  >
                    {trainer.email}
                  </a>
                ) : (
                  <span className="text-rose-600 font-medium text-[11px]">Not set</span>
                )}
              </div>

              <div className="flex items-center justify-between py-0.5">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Phone className="size-3.5 text-gray-400" />
                  Phone
                </span>
                {trainer.phoneNumber ? (
                  <a
                    href={`tel:${trainer.phoneNumber}`}
                    className="font-semibold text-gray-900 hover:text-[#033B36] hover:underline"
                  >
                    {trainer.phoneNumber}
                  </a>
                ) : (
                  <span className="text-gray-400 text-[11px]">—</span>
                )}
              </div>

              <div className="flex items-center justify-between py-0.5">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Briefcase className="size-3.5 text-gray-400" />
                  Employment
                </span>
                <span className="font-semibold text-gray-900">
                  {formatEmploymentType(trainer.employmentType)}
                </span>
              </div>

              <div className="flex items-center justify-between py-0.5">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <GraduationCap className="size-3.5 text-gray-400" />
                  Specialization
                </span>
                <span className="font-semibold text-gray-900">
                  {trainer.specialization || 'General'}
                </span>
              </div>

              <div className="flex items-start justify-between py-0.5">
                <span className="text-gray-500 flex items-center gap-1.5 shrink-0 pt-0.5">
                  <ShieldCheck className="size-3.5 text-gray-400" />
                  Qualifications
                </span>
                <span className="font-semibold text-gray-900 text-right leading-snug max-w-[180px]">
                  {trainer.qualifications || 'On file'}
                </span>
              </div>
            </div>
          </section>

          {/* Administrative Notes (Only rendered if notes exist) */}
          {trainer.notes && (
            <section
              aria-labelledby="admin-notes-heading"
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs"
            >
              <h2
                id="admin-notes-heading"
                className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5"
              >
                Notes
              </h2>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {trainer.notes}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
