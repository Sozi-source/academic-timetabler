import type { Metadata } from 'next';
import {
  ArrowLeft,
  CalendarCog,
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
  getAcademicYears,
} from '@/features/academic-years/queries';
import {
  AcademicPeriodStatusBadge,
} from '@/features/academic-periods/academic-period-status-badge';
import {
  EditAcademicPeriodForm,
} from '@/features/academic-periods/edit-academic-period-form';
import {
  getAcademicPeriodById,
} from '@/features/academic-periods/queries';

export const metadata: Metadata = {
  title: 'Edit Academic Period',
};

interface EditAcademicPeriodPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditAcademicPeriodPage({
  params,
}: EditAcademicPeriodPageProps) {
  const { id } = await params;

  const [
    academicPeriod,
    academicYears,
  ] = await Promise.all([
    getAcademicPeriodById(id),
    getAcademicYears(),
  ]);

  if (!academicPeriod) {
    notFound();
  }

  const availableAcademicYears =
    academicYears.filter(
      (academicYear) =>
        academicYear.status !== 'archived' ||
        academicYear.id ===
          academicPeriod.academicYearId,
    );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Academic calendar"
        title={`Edit ${academicPeriod.name}`}
        description="Update the period identity, parent Academic Year, operational dates and teaching window."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <AcademicPeriodStatusBadge
              status={academicPeriod.status}
            />

            <Badge variant="neutral">
              {academicPeriod.academicYear.name}
            </Badge>
          </div>
        }
        actions={
          <Link
            href="/timetable/academic-periods"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to Academic Periods
          </Link>
        }
      />

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <CalendarCog
                  className="size-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Academic Period details
                </h2>

                <p className="mt-1 text-xs text-text-muted">
                  Code: {academicPeriod.code}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <EditAcademicPeriodForm
              academicPeriod={academicPeriod}
              academicYears={
                availableAcademicYears
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}