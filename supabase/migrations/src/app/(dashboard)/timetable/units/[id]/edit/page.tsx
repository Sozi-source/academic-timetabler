import type { Metadata } from 'next';
import {
  ArrowLeft,
  BookOpen,
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
import { getProgrammes } from '@/features/programmes/queries';
import { EditUnitForm } from '@/features/units/edit-unit-form';
import { getUnitById } from '@/features/units/queries';

export const metadata: Metadata = {
  title: 'Edit Unit',
};

interface EditUnitPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditUnitPage({
  params,
}: EditUnitPageProps) {
  const { id } = await params;

  const [unit, programmes] = await Promise.all([
    getUnitById(id),
    getProgrammes(),
  ]);

  if (!unit) {
    notFound();
  }

  const availableProgrammes = programmes.filter(
    (programme) => programme.isActive && programme.isTimetableAvailable,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic structure"
        title={`Edit ${unit.code}`}
        description="Update curriculum unit details, contact hours, weekly sessions, and stage."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={unit.isActive ? 'success' : 'warning'}
              dot={unit.isActive}
            >
              {unit.isActive ? 'Active' : 'Inactive'}
            </Badge>

            <Badge
              variant={unit.isTimetableAvailable ? 'success' : 'neutral'}
            >
              {unit.isTimetableAvailable
                ? 'Timetable available'
                : 'Not timetable available'}
            </Badge>

            {unit.programme ? (
              <Badge variant="neutral">
                {unit.programme.code}
              </Badge>
            ) : null}
          </div>
        }
        actions={
          <Link
            href="/timetable/units"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to units
          </Link>
        }
      />

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <BookOpen className="size-5" aria-hidden="true" />
              </div>

              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Unit details
                </h2>

                <p className="mt-1 text-xs text-text-muted">
                  {unit.name}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <EditUnitForm
              unit={unit}
              programmes={availableProgrammes.length > 0 ? availableProgrammes : programmes}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

