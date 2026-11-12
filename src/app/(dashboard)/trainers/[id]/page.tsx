import {
  Briefcase,
  CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  CircleOff,
  GraduationCap,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FastTab } from '@/components/ui/fast-tab';
import { Progress } from '@/components/ui/progress';
import { RecordShell } from '@/components/ui/record-shell';
import { requireHodAccess } from '@/features/auth/authorization';
import { getTrainerAccessRegister } from '@/features/trainer-access/queries';
import { TrainerAccessAction } from '@/features/trainer-access/trainer-access-action';
import { TrainerAccessPinAction } from '@/features/trainer-access/trainer-access-pin-action';
import {
  setTrainerActiveAction,
  setTrainerTimetableAvailabilityAction,
} from '@/features/trainers/actions';
import {
  getTrainerAllocations,
  getTrainerById,
} from '@/features/trainers/queries';
import { ResetTrainerPassword } from '@/features/trainers/reset-trainer-password';

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

export async function generateMetadata({
  params,
}: TrainerDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  const trainer = await getTrainerById(id);

  return {
    title: trainer
      ? `${trainer.fullName} - Staff Profile | Academic Planning System`
      : 'Trainer Not Found',
    description:
      'Detailed trainer profile, workspace access status, and teaching allocations.',
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
  const utilizationPercentage = Math.round(
    (totalAllocatedHours / targetHours) * 100,
  );

  const subtitleParts = [
    trainer.staffNumber,
    formatWorkloadRole(trainer.workloadRole),
    trainer.homeDepartment || 'Human Nutrition & Dietetics',
  ].filter(Boolean);

  return (
    <RecordShell
      title={trainer.fullName}
      subtitle={subtitleParts.join(' · ')}
      status={{
        label: !trainer.isActive
          ? 'Inactive'
          : trainer.isTimetableAvailable
            ? 'Active · Timetable Available'
            : 'Active · Timetable Unavailable',
        variant: !trainer.isActive
          ? 'neutral'
          : trainer.isTimetableAvailable
            ? 'success'
            : 'warning',
      }}
      activeTab="overview"
      tabs={[
        {
          key: 'overview',
          label: 'Overview',
          href: `/trainers/${trainer.id}`,
        },
        {
          key: 'portal',
          label: 'Staff portal view',
          href: `/trainers/${trainer.id}/portal-view`,
        },
        {
          key: 'edit',
          label: 'Edit profile',
          href: `/timetable/trainers/${trainer.id}/edit`,
        },
      ]}
      actions={
        <div className="flex flex-wrap items-start gap-2">
          {accessState === 'linked' ? (
            <Badge variant="success">Portal Active</Badge>
          ) : accessState === 'ready_to_link' ? (
            <TrainerAccessAction trainerId={trainer.id} />
          ) : accessState === 'account_required' ? (
            <Badge variant="neutral">Pending Signup</Badge>
          ) : (
            <Badge variant="danger">Email Required</Badge>
          )}

          {trainer.isActive &&
          trainer.email &&
          ['linked', 'ready_to_link', 'account_required'].includes(accessState) ? (
            <TrainerAccessPinAction trainerId={trainer.id} />
          ) : null}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8 h-auto py-1.5 text-xs font-semibold"
          >
            <Link href={`/timetable/trainers/${trainer.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" aria-hidden="true" />
              Edit Profile
            </Link>
          </Button>

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
                className="min-h-11 sm:min-h-8 h-auto py-1.5 text-xs font-semibold"
                title={
                  trainer.isTimetableAvailable
                    ? 'Mark unavailable for timetabling'
                    : 'Make available for timetabling'
                }
              >
                {trainer.isTimetableAvailable ? (
                  <>
                    <CalendarX2
                      className="mr-1.5 size-3.5 text-text-subtle"
                      aria-hidden="true"
                    />
                    Disable Timetable
                  </>
                ) : (
                  <>
                    <CalendarCheck2
                      className="mr-1.5 size-3.5 text-primary"
                      aria-hidden="true"
                    />
                    Enable Timetable
                  </>
                )}
              </Button>
            </form>
          ) : null}

          <form action={setTrainerActiveAction}>
            <input type="hidden" name="id" value={trainer.id} />
            <input
              type="hidden"
              name="isActive"
              value={trainer.isActive ? 'false' : 'true'}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8 h-auto py-1.5 text-xs font-semibold"
              title={
                trainer.isActive
                  ? 'Deactivate trainer record'
                  : 'Activate trainer record'
              }
            >
              {trainer.isActive ? (
                <>
                  <CircleOff
                    className="mr-1.5 size-3.5 text-danger"
                    aria-hidden="true"
                  />
                  Deactivate
                </>
              ) : (
                <>
                  <CheckCircle2
                    className="mr-1.5 size-3.5 text-primary"
                    aria-hidden="true"
                  />
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
      }
    >
      <div className="space-y-3">
        <FastTab
          title="Profile and workload"
          summary={`${totalAllocatedHours}/${targetHours}h weekly (${utilizationPercentage}%) · ${formatEmploymentType(trainer.employmentType)}`}
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {/* Workload Card */}
            <Card className="space-y-2 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
                  Weekly Workload
                </span>
                <span className="font-mono font-bold text-text-primary">
                  {totalAllocatedHours} / {targetHours} hrs
                </span>
              </div>

              <Progress
                value={utilizationPercentage}
                max={100}
                className="h-1.5 bg-surface-muted"
                indicatorClassName={
                  utilizationPercentage > 100
                    ? 'bg-warning'
                    : 'bg-primary'
                }
              />

              <div className="flex items-center justify-between text-[11px] font-medium text-text-muted">
                <span>{utilizationPercentage}% allocated</span>
                <span>Max {trainer.maximumDailyHours}h/day</span>
              </div>
            </Card>

            {/* Contact & Employment Card */}
            <Card className="space-y-2 p-3 text-xs shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <Mail className="size-3.5 text-text-subtle" />
                  Email
                </span>
                {trainer.email ? (
                  <a
                    href={`mailto:${trainer.email}`}
                    className="max-w-[200px] truncate font-semibold text-text-primary hover:text-primary hover:underline"
                  >
                    {trainer.email}
                  </a>
                ) : (
                  <span className="text-[11px] font-medium text-danger">
                    Not set
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <Phone className="size-3.5 text-text-subtle" />
                  Phone
                </span>
                {trainer.phoneNumber ? (
                  <a
                    href={`tel:${trainer.phoneNumber}`}
                    className="font-semibold text-text-primary hover:text-primary hover:underline"
                  >
                    {trainer.phoneNumber}
                  </a>
                ) : (
                  <span className="text-[11px] text-text-subtle">—</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <Briefcase className="size-3.5 text-text-subtle" />
                  Employment
                </span>
                <span className="font-semibold text-text-primary">
                  {formatEmploymentType(trainer.employmentType)}
                </span>
              </div>
            </Card>

            {/* Academic Credentials Card */}
            <Card className="space-y-2 p-3 text-xs shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <GraduationCap className="size-3.5 text-text-subtle" />
                  Specialization
                </span>
                <span className="truncate font-semibold text-text-primary">
                  {trainer.specialization || 'General'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-text-muted">
                  <ShieldCheck className="size-3.5 text-text-subtle" />
                  Qualifications
                </span>
                <span className="max-w-[200px] text-right font-semibold leading-snug text-text-primary">
                  {trainer.qualifications || 'On file'}
                </span>
              </div>
            </Card>
          </div>
        </FastTab>

        <FastTab
          title="Teaching allocations"
          summary={`${allocations.length} unit${allocations.length === 1 ? '' : 's'} · ${totalAllocatedHours}h/wk`}
          actions={
            <Link
              href="/timetable/teaching-allocations"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-surface px-2.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <Plus className="size-3 text-text-muted" />
              <span>Assign unit</span>
            </Link>
          }
        >
          {allocations.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">
              No units currently assigned to this trainer.
            </p>
          ) : (
            <div className="divide-y divide-border-soft">
              {allocations.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary-deep">
                        {item.unitCode}
                      </span>
                      <span className="truncate text-xs font-semibold text-text-primary">
                        {item.unitName}
                      </span>
                      {item.deliveryMode &&
                        item.deliveryMode.toLowerCase() !== 'theory' && (
                          <Badge variant="warning">{item.deliveryMode}</Badge>
                        )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {item.cohortName} · {item.cohortSize} students
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-right sm:shrink-0">
                    <span className="font-mono text-xs font-bold text-text-primary">
                      {item.weeklyHours}h / wk
                    </span>
                    <span className="text-[11px] text-text-subtle">
                      {item.weeklySessions} session
                      {item.weeklySessions === 1 ? '' : 's'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </FastTab>

        {trainer.notes ? (
          <FastTab title="Administrative notes">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
              {trainer.notes}
            </p>
          </FastTab>
        ) : null}
      </div>
    </RecordShell>
  );
}
