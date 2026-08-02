import type { Metadata } from 'next';
import {
  ArrowLeft,
  GraduationCap,
  Timer,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  EditProgrammeForm,
} from '@/features/programmes/edit-programme-form';
import {
  getProgrammeById,
} from '@/features/programmes/queries';
import {
  programmeAwardLevelOptions,
} from '@/features/programmes/types';

export const metadata: Metadata = {
  title: 'Edit Programme',
};

interface EditProgrammePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditProgrammePage({
  params,
}: EditProgrammePageProps) {
  const { id } = await params;

  const programme =
    await getProgrammeById(id);

  if (!programme) {
    notFound();
  }

  const awardLevelLabel =
    programmeAwardLevelOptions.find(
      (option) =>
        option.value === programme.awardLevel,
    )?.label ?? programme.awardLevel;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Academic structure"
        title={`Edit ${programme.code}`}
        description="Update programme identity, award level, duration, Academic Period structure and cohort-planning limits."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                programme.isActive
                  ? 'success'
                  : 'warning'
              }
              dot={programme.isActive}
            >
              {programme.isActive
                ? 'Active'
                : 'Inactive'}
            </Badge>

            <Badge
              variant={
                programme.isTimetableAvailable
                  ? 'success'
                  : 'neutral'
              }
            >
              {programme.isTimetableAvailable
                ? 'Timetable available'
                : 'Not timetable available'}
            </Badge>

            <Badge variant="neutral">
              {awardLevelLabel}
            </Badge>

            <Badge variant="neutral">
              <Timer
                className="mr-1 size-3.5"
                aria-hidden="true"
              />
              {programme.durationValue}{' '}
              {programme.durationUnit}
            </Badge>
          </div>
        }
        actions={
          <Link
            href="/timetable/programmes"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to programmes
          </Link>
        }
      />

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <GraduationCap
                  className="size-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Programme details
                </h2>

                <p className="mt-1 text-xs text-text-muted">
                  {programme.name}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <EditProgrammeForm
              programme={programme}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}