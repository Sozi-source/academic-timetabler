import { CrudModal } from '@/components/ui/crud-modal';
import type { Metadata } from 'next';
import {
  BookOpenCheck,
  CalendarCheck2,
  GraduationCap,
  Plus,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';

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
  CreateProgrammeForm,
} from '@/features/programmes/create-programme-form';
import { getWorkingDepartments } from '@/features/organization/queries';
import {
  getProgrammes,
} from '@/features/programmes/queries';
import {
  ProgrammeTable,
} from '@/features/programmes/programme-table';

export const metadata: Metadata = {
  title: 'Programmes',
  description:
    'Register and manage academic programmes used by cohorts, units and timetables.',
};

export default async function ProgrammesPage() {
  const [programmes, departments] =
    await Promise.all([
      getProgrammes(),
      getWorkingDepartments(),
    ]);

  const activeProgrammes =
    programmes.filter(
      (programme) =>
        programme.isActive,
    );

  const availableProgrammes =
    programmes.filter(
      (programme) =>
        programme.isActive &&
        programme.isTimetableAvailable,
    );

  const diplomaProgrammes =
    programmes.filter(
      (programme) =>
        programme.isActive &&
        programme.awardLevel === 'diploma',
    );

  const plannedCohortCapacity =
    availableProgrammes.reduce(
      (total, programme) =>
        total +
        (programme.maximumCohortSize ?? 0),
      0,
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic structure"
        title="Programmes"
        description="Register programmes, award levels and cohort-planning limits."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {programmes.length === 1
                ? '1 programme'
                : `${programmes.length} programmes`}
            </Badge>

            <Badge variant="success" dot>
              {availableProgrammes.length} timetable available
            </Badge>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/timetable/programmes/import"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <Upload className="size-4" aria-hidden="true" />
              Import programmes
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
                Add programme
              </Button>
            </DrawerTrigger>

            <DrawerContent>
              <DrawerHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <GraduationCap
                      className="size-5"
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <DrawerTitle>
                      Register programme
                    </DrawerTitle>
                  </div>
                </div>
              </DrawerHeader>

              <DrawerBody className="pb-10">
                <CrudModal
          title="Create Programme"
          description="Register a programme without reducing the records workspace."
          triggerLabel="Create Programme"
          widthClassName="max-w-2xl"
        >
          <CreateProgrammeForm
                  departments={departments}
                />
        </CrudModal>
              </DrawerBody>
            </DrawerContent>
          </Drawer>
          </div>
        }
      />

      <section
        aria-label="Programme metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Registered programmes"
          value={String(programmes.length)}
          description="All retained programme records"
          icon={GraduationCap}
          status="Total"
        />

        <MetricCard
          label="Active programmes"
          value={String(activeProgrammes.length)}
          description="Currently operational programmes"
          icon={CalendarCheck2}
          status="Active"
        />

        <MetricCard
          label="Diploma programmes"
          value={String(diplomaProgrammes.length)}
          description="Active diploma-level programmes"
          icon={BookOpenCheck}
          status="Diploma"
        />

        <MetricCard
          label="Planned cohort capacity"
          value={String(plannedCohortCapacity)}
          description="Combined configured cohort limits"
          icon={Users}
          status="Learners"
        />
      </section>

      <ProgrammeTable
        programmes={programmes}
      />
    </div>
  );
}
