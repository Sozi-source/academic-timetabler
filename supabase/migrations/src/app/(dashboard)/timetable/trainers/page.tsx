import { CrudModal } from '@/components/ui/crud-modal';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { getWorkingDepartments } from '@/features/organization/queries';
import { CreateTrainerForm } from '@/features/trainers/create-trainer-form';
import { getTrainers } from '@/features/trainers/queries';
import { TrainerTable } from '@/features/trainers/trainer-table';

export const metadata: Metadata = {
  title: 'Trainers',
  description: 'Manage trainers and timetable availability.',
};

export default async function TrainersPage() {
  const [trainers, departments] = await Promise.all([
    getTrainers(),
    getWorkingDepartments(),
  ]);

  const availableTrainers = trainers.filter(
    (trainer) => trainer.isActive && trainer.isTimetableAvailable,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trainers"
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {trainers.length} trainer{trainers.length === 1 ? '' : 's'}
            </Badge>
            <span className="text-xs text-text-muted xl:text-sm">
              {availableTrainers.length} available
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/trainers/availability">Availability</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/trainers/import">
                <Upload className="size-4" aria-hidden="true" />
                Import
              </Link>
            </Button>
            <CrudModal
              title="Add trainer"
              triggerLabel="Add trainer"
              widthClassName="max-w-2xl"
            >
              <CreateTrainerForm departments={departments} />
            </CrudModal>
          </div>
        }
      />

      <div className="flex justify-end">
        <Link
          href="/timetable/trainers/access"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
        >
          Staff access
        </Link>
      </div>

      <TrainerTable trainers={trainers} />
    </div>
  );
}
