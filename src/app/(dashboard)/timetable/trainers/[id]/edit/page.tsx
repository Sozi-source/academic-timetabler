import type { Metadata } from 'next';
import {
  ArrowLeft,
  Clock3,
  UserRound,
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
  EditTrainerForm,
} from '@/features/trainers/edit-trainer-form';
import {
  getTrainerById,
} from '@/features/trainers/queries';

export const metadata: Metadata = {
  title: 'Edit Trainer',
};

interface EditTrainerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditTrainerPage({
  params,
}: EditTrainerPageProps) {
  const { id } = await params;

  const trainer = await getTrainerById(id);

  if (!trainer) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Scheduling resources"
        title={`Edit ${trainer.fullName}`}
        description="Update trainer identity, contacts, employment category, specialization and teaching-load limits."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                trainer.isActive
                  ? 'success'
                  : 'warning'
              }
              dot={trainer.isActive}
            >
              {trainer.isActive
                ? 'Active'
                : 'Inactive'}
            </Badge>

            <Badge
              variant={
                trainer.isTimetableAvailable
                  ? 'success'
                  : 'neutral'
              }
            >
              {trainer.isTimetableAvailable
                ? 'Timetable available'
                : 'Not timetable available'}
            </Badge>

            <Badge variant="neutral">
              <Clock3
                className="mr-1 size-3.5"
                aria-hidden="true"
              />
              {trainer.maximumWeeklyHours} hrs/week
            </Badge>
          </div>
        }
        actions={
          <Link
            href="/timetable/trainers"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to trainers
          </Link>
        }
      />

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <UserRound
                  className="size-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Trainer details
                </h2>

                <p className="mt-1 text-xs text-text-muted">
                  {trainer.staffNumber}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <EditTrainerForm
              trainer={trainer}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}