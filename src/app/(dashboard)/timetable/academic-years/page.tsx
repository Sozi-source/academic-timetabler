import type { Metadata } from 'next';
import {
  CalendarRange,
  Info,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  AcademicYearList,
} from '@/features/academic-years/academic-year-list';
import {
  CreateAcademicYearForm,
} from '@/features/academic-years/create-academic-year-form';
import {
  getAcademicYears,
} from '@/features/academic-years/queries';

export const metadata: Metadata = {
  title: 'Academic Years',
  description:
    'Create and manage institution-wide Academic Years.',
};

export default async function AcademicYearsPage() {
  const academicYears =
    await getAcademicYears();

  const activeYear =
    academicYears.find(
      (academicYear) =>
        academicYear.status === 'active',
    );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Academic calendar"
        title="Academic Years"
        description="Define the institution-wide calendar years that contain academic periods, timetables, cohort activity and reporting cycles."
        context={
          activeYear ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-success-border bg-success-surface px-3 py-1.5 text-xs font-semibold text-success">
              <span className="size-1.5 rounded-full bg-success" />
              Active: {activeYear.name}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-warning-border bg-warning-surface px-3 py-1.5 text-xs font-semibold text-warning">
              <Info
                className="size-3.5"
                aria-hidden="true"
              />
              No active Academic Year
            </div>
          )
        }
      />

      <section className="grid items-start gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <CalendarRange
                  className="size-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Create Academic Year
                </h2>

                <p className="mt-1 text-xs text-text-muted">
                  New years begin in planned status.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <CreateAcademicYearForm />
          </CardContent>
        </Card>

        <section aria-labelledby="academic-year-records">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2
                id="academic-year-records"
                className="text-lg font-semibold text-text-primary"
              >
                Academic Year records
              </h2>

              <p className="mt-1 text-sm text-text-secondary">
                {academicYears.length === 1
                  ? '1 Academic Year'
                  : `${academicYears.length} Academic Years`}
              </p>
            </div>
          </div>

          <AcademicYearList
            academicYears={academicYears}
          />
        </section>
      </section>
    </div>
  );
}