import type { Metadata } from 'next';
import {
  Accessibility,
  Building2,
  CalendarCheck2,
  Plus,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import {
  CreateRoomForm,
} from '@/features/rooms/create-room-form';
import {
  getRooms,
} from '@/features/rooms/queries';
import {
  RoomTable,
} from '@/features/rooms/room-table';

export const metadata: Metadata = {
  title: 'Rooms',
  description:
    'Register and manage teaching rooms and timetable spaces.',
};

export default async function RoomsPage() {
  const rooms = await getRooms();

  const activeRooms = rooms.filter(
    (room) => room.isActive,
  );

  const availableRooms = rooms.filter(
    (room) =>
      room.isActive &&
      room.isTimetableAvailable,
  );

  const accessibleRooms = rooms.filter(
    (room) =>
      room.isActive &&
      room.isAccessible,
  );

  const totalCapacity = availableRooms.reduce(
    (total, room) =>
      total + room.capacity,
    0,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Scheduling resources"
        title="Rooms"
        description="Register classrooms, laboratories, kitchens and other spaces available for teaching and timetable scheduling."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {rooms.length === 1
                ? '1 room'
                : `${rooms.length} rooms`}
            </Badge>

            <Badge variant="success" dot>
              {availableRooms.length} timetable available
            </Badge>
          </div>
        }
        actions={
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                leadingIcon={
                  <Plus
                    className="size-4"
                    aria-hidden="true"
                  />
                }
              >
                Add room
              </Button>
            </DrawerTrigger>

            <DrawerContent>
              <DrawerHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Building2
                      className="size-5"
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <DrawerTitle>
                      Register room
                    </DrawerTitle>

                    <DrawerDescription>
                      Add a teaching or institutional
                      space to the timetable resources.
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <DrawerBody className="pb-10">
                <CreateRoomForm />
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        }
      />

      <section
        aria-label="Room metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Registered rooms"
          value={String(rooms.length)}
          description="All retained teaching spaces"
          icon={Building2}
          status="Total"
        />

        <MetricCard
          label="Active rooms"
          value={String(activeRooms.length)}
          description="Currently operational spaces"
          icon={CalendarCheck2}
          status="Active"
        />

        <MetricCard
          label="Accessible rooms"
          value={String(accessibleRooms.length)}
          description="Accessibility-ready spaces"
          icon={Accessibility}
          status="Access"
        />

        <MetricCard
          label="Available capacity"
          value={String(totalCapacity)}
          description="Seats across timetable rooms"
          icon={Users}
          status="Capacity"
        />
      </section>

      <RoomTable rooms={rooms} />
    </div>
  );
}