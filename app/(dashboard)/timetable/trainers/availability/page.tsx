import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import {
  prioritizeActiveAcademicPeriods,
  resolveAcademicPeriodId,
} from '@/features/academic-periods/selection';
import {
  resetTrainerAvailabilityAction,
  saveTrainerAvailabilityAction,
} from '@/features/trainers/availability-actions';
import { initializeStandardCalendarAction } from '@/features/timetable-calendar/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type TrainerItem = {
  id: string;
  full_name: string;
  employment_type: string;
  availability_mode: 'generally_available' | 'selected_slots_only';
};

type DayItem = {
  id: string;
  day_of_week: string;
};

type SlotItem = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
};

type Period = {
  id: string;
  code: string;
  name: string;
  status: 'planned' | 'active';
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    trainer?: string;
    period?: string;
    saved?: string;
    mode?: string;
    returnTo?: string;
  }>;
}) {
  const db = await createClient();
  const params = await searchParams;

  const [{ data: trainers }, { data: periods }] = await Promise.all([
    db
      .from('trainers')
      .select('id,full_name,employment_type,availability_mode')
      .eq('is_active', true)
      .order('full_name'),
    db
      .from('academic_periods')
      .select('id,code,name,status')
      .in('status', ['planned', 'active'])
      .order('starts_on', { ascending: false }),
  ]);

  const trainerList = (trainers ?? []) as TrainerItem[];
  const trainerId = params.trainer ?? trainerList[0]?.id ?? '';
  const trainer = trainerList.find((item) => item.id === trainerId) ?? null;

  const selectablePeriods = prioritizeActiveAcademicPeriods(
    (periods ?? []) as Period[],
  );
  const periodId = resolveAcademicPeriodId(selectablePeriods, params.period);
  const selectedPeriod = selectablePeriods.find((item) => item.id === periodId);

  const empty = Promise.resolve({ data: [] });
  const [{ data: days }, { data: slots }, { data: saved }] = await Promise.all([
    periodId
      ? db
          .from('working_days')
          .select('id,day_of_week')
          .eq('academic_period_id', periodId)
          .eq('is_enabled', true)
          .order('sequence_number')
      : empty,
    periodId
      ? db
          .from('time_slots')
          .select('id,name,starts_at,ends_at')
          .eq('academic_period_id', periodId)
          .eq('is_enabled', true)
          .eq('slot_type', 'teaching')
          .order('sequence_number')
      : empty,
    trainerId && periodId
      ? db
          .from('trainer_availability')
          .select('working_day_id,time_slot_id')
          .eq('trainer_id', trainerId)
          .eq('academic_period_id', periodId)
      : empty,
  ]);

  const dayList = (days ?? []) as DayItem[];
  const slotList = (slots ?? []) as SlotItem[];
  const selected = new Set(
    (saved ?? []).map(
      (item) => `${item.working_day_id}:${item.time_slot_id}`,
    ),
  );
  const usesStandardWeek = trainer?.availability_mode === 'generally_available';
  const calendarReady = Boolean(dayList.length && slotList.length);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Trainers"
        title="Trainer availability"
        description="Tick the sessions the trainer can teach."
        context={
          selectedPeriod ? (
            <span className="text-xs font-medium text-text-muted xl:text-sm">
              {selectedPeriod.name}
            </span>
          ) : undefined
        }
      />

      {params.saved === '1' ? (
        <div className="flex items-center gap-2 rounded-xl border border-success-border bg-success-surface px-3 py-2.5 text-xs font-semibold text-success xl:text-sm">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Availability saved.
        </div>
      ) : null}

      <Card className="p-3 xl:p-4">
        <form
          method="get"
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        >
          <label className="text-xs font-semibold text-text-primary xl:text-sm">
            Trainer
            <Select
              name="trainer"
              defaultValue={trainerId}
              className="mt-1.5"
            >
              {trainerList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.full_name}
                </option>
              ))}
            </Select>
          </label>

          <label className="text-xs font-semibold text-text-primary xl:text-sm">
            Academic Period
            <Select
              name="period"
              defaultValue={periodId}
              className="mt-1.5"
            >
              {selectablePeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.code} - {period.name}
                  {period.status === 'active' ? ' (active)' : ''}
                </option>
              ))}
            </Select>
          </label>

          <Button type="submit" variant="outline">
            Load
          </Button>
        </form>
      </Card>

      {!calendarReady ? (
        <Card className="border-warning-border bg-warning-surface p-4">
          <form action={initializeStandardCalendarAction}>
            <input type="hidden" name="academicPeriodId" value={periodId} />
            <p className="text-sm font-semibold text-text-primary">
              Teaching calendar is not ready.
            </p>
            <Button type="submit" className="mt-3">
              Initialize calendar
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-text-primary xl:text-base">
                {trainer?.full_name ?? 'Trainer'}
              </h2>
              <p className="mt-0.5 text-[11px] text-text-muted xl:text-xs">
                {usesStandardWeek
                  ? 'Standard week - all teaching sessions available'
                  : 'Custom availability - unchecked sessions are unavailable'}
              </p>
            </div>

            {!usesStandardWeek ? (
              <form action={resetTrainerAvailabilityAction}>
                <input type="hidden" name="trainerId" value={trainerId} />
                <input type="hidden" name="academicPeriodId" value={periodId} />
                <Button type="submit" variant="outline" size="sm">
                  Use standard week
                </Button>
              </form>
            ) : null}
          </div>

          <form action={saveTrainerAvailabilityAction}>
            <input type="hidden" name="trainerId" value={trainerId} />
            <input type="hidden" name="academicPeriodId" value={periodId} />
            <input type="hidden" name="returnTo" value={params.returnTo ?? ''} />

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[620px] text-xs xl:text-sm">
                <thead className="bg-surface-subtle text-text-secondary">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Day</th>
                    {slotList.map((slot) => (
                      <th
                        key={slot.id}
                        className="px-3 py-2.5 text-center font-semibold"
                      >
                        <div>{slot.name}</div>
                        <div className="mt-0.5 text-[10px] font-normal text-text-muted xl:text-[11px]">
                          {slot.starts_at.slice(0, 5)}-{slot.ends_at.slice(0, 5)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayList.map((day) => (
                    <tr key={day.id} className="border-t border-border">
                      <th className="px-3 py-3 text-left font-semibold capitalize text-text-primary">
                        {day.day_of_week}
                      </th>
                      {slotList.map((slot) => {
                        const value = `${day.id}:${slot.id}`;
                        const checked = usesStandardWeek || selected.has(value);

                        return (
                          <td key={slot.id} className="px-3 py-3 text-center">
                            <label className="inline-flex cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                name="availableSlot"
                                value={value}
                                defaultChecked={checked}
                                className="size-4 rounded border-border-strong"
                              />
                              <span className="sr-only">
                                {day.day_of_week} {slot.name} available
                              </span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end">
              <Button type="submit">Save availability</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
