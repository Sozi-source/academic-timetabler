import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Presentation,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  canProvisionTrainerAccess,
  trainerAccessDetail,
  trainerAccessLabel,
} from '@/features/trainer-access/domain';
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
      {/* 1. Header & Navigation */}
      <PageHeader
        eyebrow="Staff Directory"
        title={trainer.fullName}
        description={`Trainer profile, workspace authorization, and institutional teaching parameters.`}
        icon={User}
        backHref="/trainers"
        backLabel="Staff & Trainers"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="primary" size="sm" className="bg-[#033B36] text-white hover:bg-[#022A26] shadow-xs">
              <Link href={`/trainers/${trainer.id}/portal-view`}>
                <Eye className="size-3.5" aria-hidden="true" />
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
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit Profile
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/trainers/availability">
                <CalendarCheck className="size-3.5" aria-hidden="true" />
                Availability
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/teaching-allocations">
                <BookOpen className="size-3.5" aria-hidden="true" />
                Assign Units
              </Link>
            </Button>
          </div>
        }
      />

      {/* 2. Top Workspace Authorization & Approval Banner */}
      {accessState === 'ready_to_link' ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-amber-900">
                Matching Account Found · Pending HOD Approval
              </p>
              <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
                A registered user account matching <span className="font-semibold text-amber-900">{trainer.email}</span> is awaiting authorization. Approve and link workspace access now.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ResetTrainerPassword
              trainerId={trainer.id}
              trainerName={trainer.fullName}
              trainerEmail={trainer.email}
              buttonVariant="outline"
              buttonSize="sm"
              buttonLabel="Reset Password"
            />
            <TrainerAccessAction trainerId={trainer.id} />
          </div>
        </div>
      ) : accessState === 'linked' ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4.5 text-emerald-600 shrink-0" />
            <span>
              <strong>Staff Workspace is Active & Linked:</strong> {trainer.fullName} is authorized to sign in with <code className="font-mono text-emerald-900">{trainer.email}</code>.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="primary" size="sm" className="bg-[#033B36] text-white hover:bg-[#022A26] shadow-xs">
              <Link href={`/trainers/${trainer.id}/portal-view`}>
                <Eye className="size-3.5" aria-hidden="true" />
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
            <Badge variant="success">Active Workspace</Badge>
          </div>
        </div>
      ) : accessState === 'email_required' ? (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-4.5 text-red-600 shrink-0" />
            <span>
              <strong>Email Required:</strong> Add a college email address to this trainer profile to enable staff workspace registration and account linking.
            </span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/timetable/trainers/${trainer.id}/edit`}>
              Add Email
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-200 bg-gray-50/80 p-4 text-xs text-gray-700">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4.5 text-gray-500 shrink-0" />
            <span>
              <strong>Awaiting Registration / Password:</strong> Set a temporary password directly or have the trainer register with <code className="font-mono">{trainer.email}</code>.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ResetTrainerPassword
              trainerId={trainer.id}
              trainerName={trainer.fullName}
              trainerEmail={trainer.email}
              buttonVariant="primary"
              buttonSize="sm"
              buttonLabel="Set Temporary Password"
            />
            <Badge variant="neutral">Registration Pending</Badge>
          </div>
        </div>
      )}

      {/* 3. Key Telemetry Cards */}
      <section aria-label="Trainer Status Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Account Status */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Account Status</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-base font-bold text-gray-900">
              {trainer.isActive ? 'Active Staff' : 'Inactive'}
            </span>
            <Badge variant={trainer.isActive ? 'success' : 'neutral'}>
              {trainer.isActive ? 'Active' : 'Disabled'}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Institutional record</p>
        </div>

        {/* Card 2: Timetable Availability */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Timetable Availability</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-base font-bold text-gray-900">
              {trainer.isTimetableAvailable ? 'Available' : 'Unavailable'}
            </span>
            <Badge variant={trainer.isTimetableAvailable ? 'primary' : 'neutral'}>
              {formatAvailabilityMode(trainer.availabilityMode)}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Scheduling engine flag</p>
        </div>

        {/* Card 3: Weekly Workload Target (Corrected) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Weekly Workload Target</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-base font-bold text-gray-900">
              {trainer.normalWeeklyHours} hrs / wk
            </span>
            <span className="text-xs font-semibold text-gray-500">
              Max {trainer.maximumDailyHours}h / day
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">{formatWorkloadRole(trainer.workloadRole)}</p>
        </div>

        {/* Card 4: Workspace Authorization */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Workspace Authorization</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-base font-bold text-gray-900">
              {trainerAccessLabel(accessState)}
            </span>
            <Badge variant={accessState === 'linked' ? 'success' : accessState === 'ready_to_link' ? 'primary' : 'neutral'}>
              {accessState === 'linked' ? 'Linked' : 'Pending'}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Staff portal state</p>
        </div>
      </section>

      {/* 4. Detailed Profile & Workload Information Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 max-w-5xl">
        {/* Contact & Administrative Details */}
        <section aria-labelledby="contact-info-heading" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 id="contact-info-heading" className="text-sm font-bold text-gray-900">
              Contact & Identity Information
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/timetable/trainers/${trainer.id}/edit`} className="text-xs text-[#033B36]">
                <Pencil className="size-3 mr-1" />
                Edit
              </Link>
            </Button>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500 flex items-center gap-1.5">
                <Mail className="size-3.5 text-gray-400" />
                College Email
              </span>
              {trainer.email ? (
                <a href={`mailto:${trainer.email}`} className="font-semibold text-gray-900 hover:text-[#033B36] hover:underline">
                  {trainer.email}
                </a>
              ) : (
                <span className="text-red-500 font-medium italic">Not set</span>
              )}
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500 flex items-center gap-1.5">
                <Phone className="size-3.5 text-gray-400" />
                Phone Number
              </span>
              {trainer.phoneNumber ? (
                <a href={`tel:${trainer.phoneNumber}`} className="font-semibold text-gray-900 hover:text-[#033B36] hover:underline">
                  {trainer.phoneNumber}
                </a>
              ) : (
                <span className="text-gray-400 italic">Not set</span>
              )}
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Staff Number</span>
              <span className="font-mono font-semibold text-gray-900">{trainer.staffNumber || '—'}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Employment Type</span>
              <span className="font-semibold text-gray-900">{formatEmploymentType(trainer.employmentType)}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Workload Role</span>
              <span className="font-semibold text-gray-900">{formatWorkloadRole(trainer.workloadRole)}</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-gray-500">Specialization</span>
              <span className="font-semibold text-gray-900">{trainer.specialization || 'General'}</span>
            </div>
          </div>
        </section>

        {/* Teaching Capacity & Academic Settings */}
        <section aria-labelledby="capacity-info-heading" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 id="capacity-info-heading" className="text-sm font-bold text-gray-900">
              Teaching Workload & Parameters
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/timetable/trainers/availability" className="text-xs text-[#033B36]">
                <CalendarCheck className="size-3 mr-1" />
                Availability
              </Link>
            </Button>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Home Department</span>
              <span className="font-semibold text-gray-900">{trainer.homeDepartment || 'Current Department'}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Qualifications</span>
              <span className="font-semibold text-gray-900">{trainer.qualifications || 'Recorded on file'}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Weekly Workload Target</span>
              <span className="font-semibold text-gray-900">{trainer.normalWeeklyHours} hrs / week</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Daily Scheduling Limit</span>
              <span className="font-semibold text-gray-900">{trainer.maximumDailyHours} hrs / day</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Availability Mode</span>
              <span className="font-semibold text-gray-900">{formatAvailabilityMode(trainer.availabilityMode)}</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-gray-500">Timetable Engine Flag</span>
              <span className="font-semibold text-gray-900">{trainer.isTimetableAvailable ? 'Included in generator' : 'Excluded from generator'}</span>
            </div>
          </div>
        </section>
      </div>

      {/* 5. Assigned Teaching Units & Workload Utilization */}
      <section aria-labelledby="teaching-allocations-heading" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#033B36]/10 text-[#033B36]">
              <Presentation className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="teaching-allocations-heading" className="text-sm font-bold text-gray-900">
                Assigned Teaching Allocations
              </h2>
              <p className="text-xs text-gray-500">
                Units and student cohorts assigned to {trainer.fullName} for active academic sessions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-gray-900">
                {totalAllocatedHours} / {targetHours} hrs
              </p>
              <p className="text-[10px] text-gray-500">
                {utilizationPercentage}% Workload Used
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="border-[#033B36] text-[#033B36] hover:bg-[#033B36]/10">
                <Link href={`/trainers/${trainer.id}/portal-view`}>
                  <Eye className="size-3.5 mr-1" aria-hidden="true" />
                  <span>View Staff Portal</span>
                </Link>
              </Button>
              <Link
                href="/timetable/teaching-allocations"
                className="inline-flex h-8 items-center justify-center rounded-lg bg-[#033B36] px-3 text-xs font-semibold text-white transition hover:bg-[#022A26]"
              >
                Manage Allocations
              </Link>
            </div>
          </div>
        </div>

        {allocations.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Presentation className="mx-auto size-6 text-gray-400" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold text-gray-900">No units assigned yet</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Assign units from Teaching Allocations to generate timetables for this trainer.
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
                className="grid gap-3 px-5 py-3.5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.25fr)_8rem_auto] md:items-center transition hover:bg-gray-50/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-gray-900">
                    <span className="font-mono text-[#033B36] mr-1.5">{item.unitCode}</span>
                    {item.unitName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {item.academicPeriodName} · {item.deliveryMode.toUpperCase()}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-800">
                    {item.cohortName} ({item.cohortCode})
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    Class Size: {item.cohortSize} students
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-900">
                    {item.weeklyHours} hrs / wk
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {item.weeklySessions} session{item.weeklySessions === 1 ? '' : 's'} × {item.sessionDurationMinutes}m
                  </p>
                </div>

                <div className="md:justify-self-end">
                  <Badge variant={item.isTimetableEnabled ? 'success' : 'neutral'}>
                    {item.isTimetableEnabled ? 'Timetable Enabled' : 'Draft'}
                  </Badge>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 6. Administrative Notes */}
      {trainer.notes && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Administrative Notes</h2>
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{trainer.notes}</p>
        </section>
      )}
    </div>
  );
}
