import type { Metadata } from 'next';
import {
  ArrowLeft,
  GraduationCap,
  Users,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import {
  getAcademicPeriods,
} from '@/features/academic-periods/queries';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  EditCohortForm,
} from '@/features/cohorts/edit-cohort-form';
import {
  getCohortById,
} from '@/features/cohorts/queries';
import {
  cohortStatusOptions,
} from '@/features/cohorts/types';
import {
  getProgrammes,
} from '@/features/programmes/queries';

export const metadata: Metadata = {
  title: 'Edit Cohort',
};

interface EditCohortPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditCohortPage({
  params,
}: EditCohortPageProps) {
  const { id } = await params;

  const [
    cohort,
    programmes,
    academicPeriods,
  ] = await Promise.all([
    getCohortById(id),
    getProgrammes(),
    getAcademicPeriods(),
  ]);

  if (!cohort) {
    notFound();
  }

  const editableProgrammes =
    programmes.filter(
      (programme) =>
        programme.isActive ||
        programme.id === cohort.programmeId,
    );

  const statusLabel =
    cohortStatusOptions.find(
      (option) =>
        option.value === cohort.status,
    )?.label ?? cohort.status;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic structure"
        title={`Edit ${cohort.code}`}
        description="Update cohort identity, programme, dates, academic progress, enrolment and lifecycle status."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                cohort.status === 'active'
                  ? 'success'
                  : cohort.status ===
                      'suspended'
                    ? 'warning'
                    : 'neutral'
              }
              dot={
                cohort.status === 'active'
              }
            >
              {statusLabel}
            </Badge>

            <Badge
              variant={
                cohort.isTimetableAvailable
                  ? 'success'
                  : 'neutral'
              }
            >
              {cohort.isTimetableAvailable
                ? 'Timetable available'
                : 'Not timetable available'}
            </Badge>

            <Badge variant="neutral">
              <Users
                className="mr-1 size-3.5"
                aria-hidden="true"
              />
              {cohort.actualSize} learners
            </Badge>

            {cohort.programme ? (
              <Badge variant="neutral">
                <GraduationCap
                  className="mr-1 size-3.5"
                  aria-hidden="true"
                />
                {cohort.programme.code}
              </Badge>
            ) : null}
          </div>
        }
        actions={
          <Link
            href="/timetable/cohorts"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to cohorts
          </Link>
        }
      />

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <UsersRound
                  className="size-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Cohort details
                </h2>

                <p className="mt-1 text-xs text-text-muted">
                  {cohort.name}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <EditCohortForm
              cohort={cohort}
              programmes={editableProgrammes}
              academicPeriods={academicPeriods}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}