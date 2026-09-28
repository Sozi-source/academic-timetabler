import type { Metadata } from 'next';
import {
  ArrowLeft,
  Building2,
  Users,
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
  EditRoomForm,
} from '@/features/rooms/edit-room-form';
import {
  getRoomById,
} from '@/features/rooms/queries';

export const metadata: Metadata = {
  title: 'Edit Room',
};

interface EditRoomPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditRoomPage({
  params,
}: EditRoomPageProps) {
  const { id } = await params;

  const room = await getRoomById(id);

  if (!room) {
    notFound();
  }

  return (
    <div className="admin-screen space-y-6">
      <PageHeader
        eyebrow="Scheduling resources"
        title={`Edit ${room.code}`}
        description="Update room details, capacity, accessibility and availability."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                room.isActive
                  ? 'success'
                  : 'warning'
              }
              dot={room.isActive}
            >
              {room.isActive
                ? 'Active'
                : 'Inactive'}
            </Badge>

            <Badge
              variant={
                room.isTimetableAvailable
                  ? 'success'
                  : 'neutral'
              }
            >
              {room.isTimetableAvailable
                ? 'Timetable available'
                : 'Not timetable available'}
            </Badge>

            <Badge variant="neutral">
              <Users
                className="mr-1 size-3.5"
                aria-hidden="true"
              />
              Capacity {room.capacity}
            </Badge>
          </div>
        }
        actions={
          <Link
            href="/timetable/rooms"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to rooms
          </Link>
        }
      />

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Building2
                  className="size-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Room details
                </h2>

                <p className="mt-1 text-xs text-text-muted">
                  {room.name}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <EditRoomForm room={room} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}