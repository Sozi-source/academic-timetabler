import type { Metadata } from 'next';
import {
  ArrowLeft,
  CalendarCog,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EditAcademicYearForm } from '@/features/academic-years/edit-academic-year-form';
import { getAcademicYearById } from '@/features/academic-years/queries';

export const metadata: Metadata = {
  title: 'Edit Academic Year',
};

interface EditAcademicYearPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditAcademicYearPage({
  params,
}: EditAcademicYearPageProps) {
  const { id } = await params;

  const academicYear =
    await getAcademicYearById(id);

  if (!academicYear) {
    notFound();
  }

  return (
    <div className="admin-screen space-y-6">
      <PageHeader
        eyebrow="Academic calendar"
        title={`Edit ${academicYear.name}`}
        description="Update the name, date range and notes for this Academic Year."
        actions={
          <Link
            href="/timetable/academic-years"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to Academic Years
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
                  Academic Year details
                </h2>

                <p className="mt-1 text-xs text-text-muted">
                  Status: {academicYear.status}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <EditAcademicYearForm
              academicYear={academicYear}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}