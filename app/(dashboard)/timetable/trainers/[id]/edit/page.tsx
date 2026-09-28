import type { Metadata } from 'next';
import {
  ArrowLeft,
  CalendarCheck,
  Clock3,
  User,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getWorkingDepartments } from '@/features/organization/queries';
import { EditTrainerForm } from '@/features/trainers/edit-trainer-form';
import { getTrainerById } from '@/features/trainers/queries';

export const metadata: Metadata = {
  title: 'Edit Trainer Profile | Academic Planning System',
  description: 'Update trainer personal details, institutional roles, and teaching workload limits.',
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

  const [trainer, departments] = await Promise.all([
    getTrainerById(id),
    getWorkingDepartments(),
  ]);

  if (!trainer) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Staff Directory"
        title={`Edit Profile: ${trainer.fullName}`}
        description="Update staff institutional credentials, contact parameters, and weekly workload targets."
        icon={User}
        backHref={`/trainers/${trainer.id}`}
        backLabel="Trainer Profile"
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={trainer.isActive ? 'success' : 'neutral'}>
              {trainer.isActive ? 'Active Staff' : 'Inactive'}
            </Badge>

            <Badge variant={trainer.isTimetableAvailable ? 'primary' : 'neutral'}>
              {trainer.isTimetableAvailable ? 'Available for Timetable' : 'Excluded from Timetable'}
            </Badge>

            <Badge variant="neutral">
              <Clock3 className="mr-1 size-3.5" aria-hidden="true" />
              {trainer.normalWeeklyHours} hrs / wk Target
            </Badge>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/trainers/${trainer.id}`}>
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                View Profile
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/trainers/availability">
                <CalendarCheck className="size-3.5" aria-hidden="true" />
                Availability Grid
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="border-gray-200 bg-white shadow-xs">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#033B36]/10 text-[#033B36]">
                <UserRound className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Trainer Configuration Form
                </h2>
                <p className="text-xs text-gray-500">
                  Staff ID: <strong className="font-mono text-gray-800">{trainer.staffNumber}</strong> · Department ID: <strong className="font-mono text-gray-800">{trainer.departmentId}</strong>
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <EditTrainerForm
            trainer={trainer}
            departments={departments}
          />
        </CardContent>
      </Card>
    </div>
  );
}
