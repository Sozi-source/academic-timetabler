import type { Metadata } from 'next';
import {
  CalendarCheck2,
  GraduationCap,
  Plus,
  Users,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import {
  CohortTable,
} from '@/features/cohorts/cohort-table';
import {
  CreateCohortForm,
} from '@/features/cohorts/create-cohort-form';
import {
  getCohorts,
} from '@/features/cohorts/queries';
import {
  getProgrammes,
} from '@/features/programmes/queries';

export const metadata: Metadata = {
  title: 'Cohorts',
  description:
    'Register and manage programme cohorts, enrolment and timetable availability.',
};

export default async function CohortsPage() {
  const [cohorts, programmes] =
    await Promise.all([
      getCohorts(),
      getProgrammes(),
    ]);

  const availableProgrammes =
    programmes.filter(
      (programme) =>
        programme.isActive &&
        programme.isTimetableAvailable,
    );

  const activeCohorts = cohorts.filter(
    (cohort) => cohort.status === 'active',
  );

  const plannedCohorts = cohorts.filter(
    (cohort) => cohort.status === 'planned',
  );

  const timetableCohorts =
    cohorts.filter(
      (cohort) =>
        cohort.isTimetableAvailable,
    );

  const totalLearners = cohorts
    .filter(
      (cohort) =>
        cohort.status === 'active',
    )
    .reduce(
      (total, cohort) =>
        total + cohort.actualSize,
      0,
    );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Academic structure"
        title="Cohorts"
        description="Manage programme intakes, enrolment numbers, academic progress and timetable availability."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {cohorts.length === 1
                ? '1 cohort'
                : `${cohorts.length} cohorts`}
            </Badge>

            <Badge variant="success" dot>
              {timetableCohorts.length} timetable available
            </Badge>
          </div>
        }
        actions={
          availableProgrammes.length > 0 ? (
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
                  Add cohort
                </Button>
              </DrawerTrigger>

              <DrawerContent>
                <DrawerHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <UsersRound
                        className="size-5"
                        aria-hidden="true"
                      />
                    </div>

                    <div>
                      <DrawerTitle>
                        Register cohort
                      </DrawerTitle>

                      <DrawerDescription>
                        Add a programme intake and its
                        learner-planning information.
                      </DrawerDescription>
                    </div>
                  </div>
                </DrawerHeader>

                <DrawerBody className="pb-10">
                  <CreateCohortForm
                    programmes={
                      availableProgrammes
                    }
                  />
                </DrawerBody>
              </DrawerContent>
            </Drawer>
          ) : null
        }
      />

      {availableProgrammes.length === 0 ? (
        <div className="rounded-2xl border border-warning-border bg-warning-surface px-5 py-4 text-sm text-text-secondary">
          Create or activate a timetable-available
          programme before registering cohorts.
        </div>
      ) : null}

      <section
        aria-label="Cohort metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Active cohorts"
          value={String(activeCohorts.length)}
          description="Currently receiving teaching"
          icon={CalendarCheck2}
          status="Active"
        />

        <MetricCard
          label="Planned cohorts"
          value={String(plannedCohorts.length)}
          description="Prepared future intakes"
          icon={UsersRound}
          status="Planned"
        />

        <MetricCard
          label="Active learners"
          value={String(totalLearners)}
          description="Confirmed learners in active cohorts"
          icon={Users}
          status="Learners"
        />

        <MetricCard
          label="Programmes represented"
          value={String(
            new Set(
              cohorts.map(
                (cohort) =>
                  cohort.programmeId,
              ),
            ).size,
          )}
          description="Programmes with registered cohorts"
          icon={GraduationCap}
          status="Programmes"
        />
      </section>

      <CohortTable
        cohorts={cohorts}
        programmeOptions={programmes.map(
          (programme) => ({
            id: programme.id,
            code: programme.code,
            name: programme.name,
          }),
        )}
      />
    </div>
  );
}