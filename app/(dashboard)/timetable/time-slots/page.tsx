import type { Metadata } from 'next';
import {
  CalendarCheck2,
  CalendarPlus,
  Clock3,
  Plus,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Select } from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  getAcademicPeriods,
} from '@/features/academic-periods/queries';
import {
  initializeDefaultWorkingDaysAction,
  initializeStandardCalendarAction,
} from '@/features/timetable-calendar/actions';
import {
  CreateTimeSlotForm,
} from '@/features/timetable-calendar/create-time-slot-form';
import {
  CreateWorkingDayForm,
} from '@/features/timetable-calendar/create-working-day-form';
import {
  getTimeSlotsByPeriod,
  getWorkingDaysByPeriod,
} from '@/features/timetable-calendar/queries';
import {
  TimeSlotTable,
} from '@/features/timetable-calendar/time-slot-table';
import {
  WorkingDayList,
} from '@/features/timetable-calendar/working-day-list';

export const metadata: Metadata = {
  title: 'Working Days and Time Slots',
  description:
    'Configure timetable teaching days and daily time slots.',
};

interface TimetableCalendarPageProps {
  searchParams: Promise<{
    period?: string;
  }>;
}

export default async function TimetableCalendarPage({
  searchParams,
}: TimetableCalendarPageProps) {
  const { period } = await searchParams;

  const academicPeriods =
    await getAcademicPeriods();

  const configurablePeriods =
    academicPeriods.filter(
      (academicPeriod) =>
        academicPeriod.academicYear.status === 'active' &&
        (academicPeriod.status === 'active' ||
          academicPeriod.status === 'planned'),
    );

  const selectedPeriod =
    configurablePeriods.find(
      (academicPeriod) =>
        academicPeriod.id === period,
    ) ??
    configurablePeriods.find(
      (academicPeriod) =>
        academicPeriod.status === 'active',
    ) ??
    configurablePeriods[0] ??
    null;

  const [workingDays, timeSlots] =
    selectedPeriod
      ? await Promise.all([
          getWorkingDaysByPeriod(
            selectedPeriod.id,
          ),
          getTimeSlotsByPeriod(
            selectedPeriod.id,
          ),
        ])
      : [[], []];

  const enabledWorkingDays =
    workingDays.filter(
      (workingDay) =>
        workingDay.isEnabled,
    ).length;

  const enabledTeachingSlots =
    timeSlots.filter(
      (timeSlot) =>
        timeSlot.isEnabled &&
        timeSlot.slotType === 'teaching',
    ).length;

  return (
    <div className="admin-screen space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.17em] text-primary">
            Timetable setup
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary sm:text-[1.75rem]">
            Working Days and Time Slots
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-text-secondary">
            Teaching days and session time slots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedPeriod ? (
            <Badge variant="primary">
              {selectedPeriod.name}
            </Badge>
          ) : null}

          <Badge variant="neutral">
            {enabledWorkingDays} enabled days
          </Badge>

          <Badge variant="neutral">
            {enabledTeachingSlots} teaching slots
          </Badge>
        </div>
      </header>

      {configurablePeriods.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CalendarCheck2
              className="mx-auto size-8 text-text-muted"
              aria-hidden="true"
            />

            <h2 className="mt-4 text-base font-semibold text-text-primary">
              No configurable Academic Period
            </h2>

            <p className="mt-2 text-sm text-text-secondary">
              Create an Academic Period before
              configuring Working Days and Time Slots.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
            <form
              method="get"
              className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:max-w-3xl"
            >
              <div className="w-full sm:max-w-md">
                <label
                  htmlFor="period"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted"
                >
                  Academic Period
                </label>

                <Select
                  id="period"
                  name="period"
                  defaultValue={
                    selectedPeriod?.id
                  }
                >
                  {configurablePeriods.map(
                    (academicPeriod) => (
                      <option
                        key={academicPeriod.id}
                        value={academicPeriod.id}
                      >
                        {academicPeriod.name}
                        {academicPeriod.status ===
                        'active'
                          ? ' - Active'
                          : ''}
                      </option>
                    ),
                  )}
                </Select>
              </div>

              <Button
                type="submit"
                variant="outline"
              >
                Load configuration
              </Button>
            </form>

            {selectedPeriod ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                <form action={initializeStandardCalendarAction}><input type="hidden" name="academicPeriodId" value={selectedPeriod.id}/><Button type="submit" variant="outline" leadingIcon={<CalendarPlus className="size-4" aria-hidden="true"/>}>Use standard calendar</Button></form>
                <span>
                Configuration applies only to{' '}
                <span className="font-semibold text-text-secondary">
                  {selectedPeriod.name}
                </span>
                </span>
              </div>
            ) : null}
          </section>

          {selectedPeriod ? (
            <Tabs defaultValue="working-days">
              <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-0 border-b border-border bg-transparent p-0">
                <TabsTrigger
                  value="working-days"
                  className="relative min-h-11 rounded-none border-b-2 border-transparent bg-transparent px-4 text-text-secondary shadow-none hover:text-text-primary data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  Working Days
                </TabsTrigger>

                <TabsTrigger
                  value="time-slots"
                  className="relative min-h-11 rounded-none border-b-2 border-transparent bg-transparent px-4 text-text-secondary shadow-none hover:text-text-primary data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  Time Slots
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="working-days"
                className="admin-screen space-y-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">
                      Working Days
                    </h2>

                    <p className="mt-1 text-sm text-text-secondary">
                      Select the days available for
                      classes in this Academic Period.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
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
                          Add Working Day
                        </Button>
                      </DrawerTrigger>

                      <DrawerContent>
                        <DrawerHeader>
                          <DrawerTitle>
                            Add Working Day
                          </DrawerTitle>
                        </DrawerHeader>

                        <DrawerBody>
                          <CreateWorkingDayForm
                            academicPeriodId={
                              selectedPeriod.id
                            }
                            configuredDays={workingDays.map(
                              (workingDay) =>
                                workingDay.dayOfWeek,
                            )}
                          />
                        </DrawerBody>
                      </DrawerContent>
                    </Drawer>

                    {workingDays.length === 0 ? (
                      <form
                        action={
                          initializeDefaultWorkingDaysAction
                        }
                      >
                        <input
                          type="hidden"
                          name="academicPeriodId"
                          value={selectedPeriod.id}
                        />

                        <Button
                          type="submit"
                          variant="outline"
                          leadingIcon={
                            <CalendarPlus
                              className="size-4"
                              aria-hidden="true"
                            />
                          }
                        >
                          Set Monday to Friday
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <WorkingDayList
                  workingDays={workingDays}
                />
              </TabsContent>

              <TabsContent
                value="time-slots"
                className="space-y-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">
                      Time Slots
                    </h2>

                    <p className="mt-1 text-sm text-text-secondary">
                      Define teaching periods, breaks,
                      lunch and other daily activities.
                    </p>
                  </div>

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
                        Add Time Slot
                      </Button>
                    </DrawerTrigger>

                    <DrawerContent>
                      <DrawerHeader>
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                            <Clock3
                              className="size-5"
                              aria-hidden="true"
                            />
                          </div>

                          <div>
                            <DrawerTitle>
                              Create Time Slot
                            </DrawerTitle>
                          </div>
                        </div>
                      </DrawerHeader>

                      <DrawerBody>
                        <CreateTimeSlotForm
                          academicPeriodId={
                            selectedPeriod.id
                          }
                        />
                      </DrawerBody>
                    </DrawerContent>
                  </Drawer>
                </div>

                <TimeSlotTable
                  timeSlots={timeSlots}
                />
              </TabsContent>
            </Tabs>
          ) : null}
        </>
      )}
    </div>
  );
}
