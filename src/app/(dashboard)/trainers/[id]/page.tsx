import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
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

function formatAvailabilityMode(mode: string): string {
  switch (mode) {
    case 'generally_available':
      return 'Generally Available';
    case 'selected_slots_only':
      return 'Selected Slots Only';
    default:
      return mode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
    <div className="space-y-6">
      {/* 1. Top Navigation & Action Toolbar (Unified, Zero Duplication) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/trainers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
        >
          <ArrowLeft className="size-3.5" />
          Back to Staff Directory
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {accessState === 'ready_to_link' && (
            <TrainerAccessAction trainerId={trainer.id} />
          )}

          <Button
            asChild
            variant="primary"
            size="sm"
            className="bg-[#033B36] text-white hover:bg-[#022A26] shadow-xs"
          >
            <Link href={`/trainers/${trainer.id}/portal-view`}>
              <Eye className="size-3.5 mr-1.5" aria-hidden="true" />
              <span>View Staff Portal</span>
            </Link>
          </Button>

          <ResetTrainerPassword
            trainerId={trainer.id}
            trainerName={trainer.fullName}
            trainerEmail={trainer.email}
            buttonVariant="outline"
            buttonSize="sm"
            buttonLabel="Reset Password"
          />

          <Button asChild variant="outline" size="sm">
            <Link href={`/timetable/trainers/${trainer.id}/edit`}>
              <Pencil className="size-3.5 mr-1.5" aria-hidden="true" />
              Edit Profile
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link href="/timetable/trainers/availability">
              <CalendarCheck className="size-3.5 mr-1.5" aria-hidden="true" />
              Availability
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Unified Hero Card: Identity, Badges & Workload Telemetry */}
      <section
        aria-label="Trainer Profile Overview"
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Identity & Status */}
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#033B36] text-base font-bold text-white shadow-xs">
              {getInitials(trainer.fullName)}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight sm:text-2xl">
                  {trainer.fullName}
                </h1>
                {trainer.staffNumber && (
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-gray-700">
                    {trainer.staffNumber}
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500">
                <span>{formatWorkloadRole(trainer.workloadRole)}</span>
                <span className="mx-1.5 text-gray-300">·</span>
                <span>{trainer.homeDepartment || 'Human Nutrition & Dietetics'}</span>
              </p>

              {/* Status Chips Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Active Staff */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    trainer.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      trainer.isActive ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  />
                  {trainer.isActive ? 'Active Staff' : 'Inactive'}
                </span>

                {/* Workspace State */}
                {accessState === 'linked' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    Portal Linked ({trainer.email})
                  </span>
                ) : accessState === 'ready_to_link' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                    <KeyRound className="size-3 text-amber-600" />
                    Pending Link ({trainer.email})
                  </span>
                ) : accessState === 'account_required' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700 border border-gray-200">
                    <Clock className="size-3 text-gray-500" />
                    Registration Pending
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                    <AlertCircle className="size-3 text-rose-600" />
                    Email Required
                  </span>
                )}

                {/* Timetable Availability */}
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 border border-gray-200">
                  <CalendarCheck className="size-3 text-gray-400" />
                  {formatAvailabilityMode(trainer.availabilityMode)}
                </span>
              </div>
            </div>
          </div>

          {/* Workload Progress Gauge */}
          <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-4 lg:min-w-[260px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600">Workload Target</span>
              <span className="font-bold text-gray-900">
                {totalAllocatedHours} / {targetHours} hrs/wk
              </span>
            </div>

            <Progress
              value={utilizationPercentage}
              max={100}
              className="h-2 bg-gray-200"
              indicatorClassName={
                utilizationPercentage > 100
                  ? 'bg-amber-600'
                  : utilizationPercentage >= 75
                  ? 'bg-[#033B36]'
                  : 'bg-emerald-600'
              }
            />

            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{utilizationPercentage}% Allocated</span>
              <span>Max {trainer.maximumDailyHours}h / day</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Content: Allocations (Left) & Credentials (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Approved Teaching Allocations (col-span-8) */}
        <div className="space-y-6 lg:col-span-8">
          <section
            aria-labelledby="teaching-allocations-heading"
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#033B36]/10 text-[#033B36]">
                  <Presentation className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <h2
                    id="teaching-allocations-heading"
                    className="text-sm font-bold text-gray-900"
                  >
                    Approved Timetable Allocations
                  </h2>
                  <p className="text-xs text-gray-500">
                    {allocations.length}{' '}
                    {allocations.length === 1 ? 'unit' : 'units'} active
                    {allocations[0]?.academicPeriodName
                      ? ` · ${allocations[0].academicPeriodName}`
                      : ''}
                  </p>
                </div>
              </div>

              <Link
                href="/timetable/teaching-allocations"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 shadow-2xs transition hover:bg-gray-50 hover:text-gray-900"
              >
                <Plus className="size-3.5 text-gray-500" />
                Assign Unit
              </Link>
            </div>

            {allocations.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Presentation
                  className="mx-auto size-7 text-gray-300"
                  aria-hidden="true"
                />
                <p className="mt-2.5 text-xs font-semibold text-gray-900">
                  No approved units assigned
                </p>
                <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
                  Assign teaching units from the allocations dashboard to schedule
                  classes for this trainer.
                </p>
                <div className="mt-4">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/timetable/teaching-allocations">
                      Assign Teaching Unit
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {allocations.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between transition hover:bg-gray-50/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900">
                        <span className="font-mono text-[#033B36] mr-2">
                          {item.unitCode}
                        </span>
                        <span>{item.unitName}</span>
                        {item.deliveryMode &&
                          item.deliveryMode.toLowerCase() !== 'theory' && (
                            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 border border-amber-200">
                              {item.deliveryMode}
                            </span>
                          )}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 sm:shrink-0">
                      <div className="text-left sm:w-36">
                        <p className="text-xs font-semibold text-gray-800">
                          {item.cohortName}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {item.cohortSize} students
                        </p>
                      </div>

                      <div className="text-right sm:w-28">
                        <p className="text-xs font-bold text-gray-900">
                          {item.weeklyHours} hrs / wk
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {item.weeklySessions} session{item.weeklySessions === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Credentials & Administrative Information (col-span-4) */}
        <div className="space-y-6 lg:col-span-4">
          <section
            aria-labelledby="contact-credentials-heading"
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4"
          >
            <h2
              id="contact-credentials-heading"
              className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2.5"
            >
              Contact & Credentials
            </h2>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
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
                  <span className="text-red-500 font-medium italic">Not set</span>
                )}
              </div>

              <div className="flex items-center justify-between py-1 border-b border-gray-50">
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
                  <span className="text-gray-400 italic">Not set</span>
                )}
              </div>

              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Briefcase className="size-3.5 text-gray-400" />
                  Employment
                </span>
                <span className="font-semibold text-gray-900">
                  {formatEmploymentType(trainer.employmentType)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <GraduationCap className="size-3.5 text-gray-400" />
                  Specialization
                </span>
                <span className="font-semibold text-gray-900">
                  {trainer.specialization || 'General'}
                </span>
              </div>

              <div className="flex items-start justify-between py-1">
                <span className="text-gray-500 flex items-center gap-1.5 shrink-0 pt-0.5">
                  <ShieldCheck className="size-3.5 text-gray-400" />
                  Qualifications
                </span>
                <span className="font-semibold text-gray-900 text-right leading-relaxed max-w-[200px]">
                  {trainer.qualifications || 'Recorded on file'}
                </span>
              </div>
            </div>
          </section>

          {/* Administrative Notes (Only rendered if notes exist) */}
          {trainer.notes && (
            <section
              aria-labelledby="admin-notes-heading"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs"
            >
              <h2
                id="admin-notes-heading"
                className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2"
              >
                Administrative Notes
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
