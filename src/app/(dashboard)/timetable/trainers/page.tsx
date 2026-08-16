import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CalendarCheck2,
  Clock3,
  Plus,
  Upload,
  UserRound,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import {
  CreateTrainerForm,
} from '@/features/trainers/create-trainer-form';
import {
  getTrainers,
} from '@/features/trainers/queries';
import {
  TrainerTable,
} from '@/features/trainers/trainer-table';
import { getWorkingDepartments } from '@/features/organization/queries';

export const metadata: Metadata = {
  title: 'Trainers',
  description:
    'Register and manage teaching staff and timetable availability.',
};

export default async function TrainersPage() {
  const [trainers, departments] =
    await Promise.all([
      getTrainers(),
      getWorkingDepartments(),
    ]);

  const activeTrainers = trainers.filter(
    (trainer) => trainer.isActive,
  );

  const availableTrainers = trainers.filter(
    (trainer) =>
      trainer.isActive &&
      trainer.isTimetableAvailable,
  );

  const fullTimeTrainers = trainers.filter(
    (trainer) =>
      trainer.isActive &&
      trainer.employmentType === 'full_time',
  );

  const totalWeeklyTarget =
    availableTrainers.reduce(
      (total, trainer) =>
        total + trainer.normalWeeklyHours,
      0,
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scheduling resources"
        title="Trainers"
        description="Register teaching staff, define weekly workload targets and control availability for unit allocation and timetable generation."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/timetable/trainers/availability" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary">Set availability</Link>
            <Badge variant="neutral">
              {trainers.length === 1
                ? '1 trainer'
                : `${trainers.length} trainers`}
            </Badge>

            <Badge variant="success" dot>
              {availableTrainers.length} timetable available
            </Badge>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/timetable/trainers/import"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <Upload
                className="size-4"
                aria-hidden="true"
              />
              Import trainers
            </Link>

            <Drawer>
            <DrawerTrigger asChild>
              <Button
                leadingIcon={
                  <Plus
                    className="size-4"
                    aria-hidden="true"
                  />
                }
              >
                Add trainer
              </Button>
            </DrawerTrigger>

            <DrawerContent>
              <DrawerHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <UserRound
                      className="size-5"
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <DrawerTitle>
                      Register trainer
                    </DrawerTitle>
                  </div>
                </div>
              </DrawerHeader>

              <DrawerBody className="pb-10">
                <CreateTrainerForm departments={departments} />
              </DrawerBody>
            </DrawerContent>
            </Drawer>
          </div>
        }
      />

      <section
        aria-label="Trainer metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Registered trainers"
          value={String(trainers.length)}
          description="All retained trainer records"
          icon={Users}
          status="Total"
        />

        <MetricCard
          label="Active trainers"
          value={String(activeTrainers.length)}
          description="Currently operational staff"
          icon={UserRound}
          status="Active"
        />

        <MetricCard
          label="Full-time trainers"
          value={String(fullTimeTrainers.length)}
          description="Active full-time teaching staff"
          icon={CalendarCheck2}
          status="Full-time"
        />

        <MetricCard
          label="Weekly targets"
          value={String(totalWeeklyTarget)}
          description="Combined standard teaching targets"
          icon={Clock3}
          status="Hours"
        />
      </section>

      <TrainerTable trainers={trainers} />
    </div>
  );
}
