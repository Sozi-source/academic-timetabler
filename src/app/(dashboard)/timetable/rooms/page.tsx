import { CrudModal } from '@/components/ui/crud-modal';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { CreateRoomForm } from '@/features/rooms/create-room-form';
import { getRooms } from '@/features/rooms/queries';
import { RoomTable } from '@/features/rooms/room-table';

export const metadata: Metadata = {
  title: 'Rooms',
  description: 'Manage teaching spaces and timetable availability.',
};

export default async function RoomsPage() {
  const rooms = await getRooms();
  const availableRooms = rooms.filter(
    (room) => room.isActive && room.isTimetableAvailable,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rooms"
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {rooms.length} room{rooms.length === 1 ? '' : 's'}
            </Badge>
            <span className="text-xs text-text-muted xl:text-sm">
              {availableRooms.length} available
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable/rooms/import">
                <Upload className="size-4" aria-hidden="true" />
                Import
              </Link>
            </Button>
            <CrudModal
              title="Add room"
              triggerLabel="Add room"
              widthClassName="max-w-2xl"
            >
              <CreateRoomForm />
            </CrudModal>
          </div>
        }
      />

      <RoomTable rooms={rooms} />
    </div>
  );
}
