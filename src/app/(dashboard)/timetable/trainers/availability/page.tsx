import { CheckCircle2 } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { prioritizeActiveAcademicPeriods, resolveAcademicPeriodId } from '@/features/academic-periods/selection';
import { saveTrainerAvailabilityAction } from '@/features/trainers/availability-actions';
import { initializeStandardCalendarAction } from '@/features/timetable-calendar/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Item = {
  id: string;
  full_name?: string;
  code?: string;
  name?: string;
  day_of_week?: string;
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
    returnTo?: string;
  }>;
}) {
  const db = await createClient();
  const params = await searchParams;

  const [{ data: trainers }, { data: periods }] = await Promise.all([
    db.from('trainers').select('id,full_name').eq('is_active', true).order('full_name'),
    db.from('academic_periods').select('id,code,name,status').in('status', ['planned', 'active']).order('starts_on', { ascending: false }),
  ]);

  const trainerId = params.trainer ?? trainers?.[0]?.id ?? '';
  const selectablePeriods = prioritizeActiveAcademicPeriods(
    (periods ?? []) as Period[],
  );
  const periodId = resolveAcademicPeriodId(
    selectablePeriods,
    params.period,
  );

  const empty = Promise.resolve({ data: [] });
  const [{ data: days }, { data: slots }, { data: saved }] = await Promise.all([
    periodId ? db.from('working_days').select('id,day_of_week').eq('academic_period_id', periodId).eq('is_enabled', true).order('sequence_number') : empty,
    periodId ? db.from('time_slots').select('id,name').eq('academic_period_id', periodId).eq('is_enabled', true).eq('slot_type', 'teaching').order('sequence_number') : empty,
    trainerId && periodId ? db.from('trainer_availability').select('working_day_id,time_slot_id').eq('trainer_id', trainerId).eq('academic_period_id', periodId) : empty,
  ]);

  const selected = new Set(
    (saved ?? []).map((item) => `${item.working_day_id}:${item.time_slot_id}`),
  );
  const calendarReady = Boolean((days ?? []).length && (slots ?? []).length);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trainer constraints"
        title="Available teaching times"
        description="Tick each session this trainer is available to teach."
      />

      {params.saved === '1' ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Teaching availability saved successfully.
        </div>
      ) : null}

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-5">
        <label className="text-sm font-medium">
          Trainer
          <select name="trainer" defaultValue={trainerId} className="mt-1 block h-10 rounded-xl border border-border px-3">
            {(trainers ?? []).map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.full_name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Academic Period
          <select name="period" defaultValue={periodId} className="mt-1 block h-10 rounded-xl border border-border px-3">
            {selectablePeriods.map((period) => <option key={period.id} value={period.id}>{period.code} — {period.name} ({period.status === 'active' ? 'Active' : 'Planned'})</option>)}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-xl border border-border px-4 font-semibold">Load</button>
      </form>

      {!calendarReady ? (
        <form action={initializeStandardCalendarAction} className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <input type="hidden" name="academicPeriodId" value={periodId} />
          <p className="font-semibold">Standard calendar not initialized</p>
          <p className="mt-1 text-sm text-text-muted">Apply the unchanged institutional days and teaching sessions to this Academic Period.</p>
          <button type="submit" className="mt-4 h-10 rounded-xl bg-primary px-4 font-semibold text-white">Initialize standard calendar</button>
        </form>
      ) : (
        <form action={saveTrainerAvailabilityAction} className="rounded-2xl border border-border bg-surface p-5">
          <input type="hidden" name="trainerId" value={trainerId} />
          <input type="hidden" name="academicPeriodId" value={periodId} />
          <input type="hidden" name="returnTo" value={params.returnTo ?? ''} />
          <div className="mb-4 rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
            <span className="font-semibold">Checked:</span> available to teach · <span className="font-semibold">Unchecked:</span> unavailable or engaged
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className="p-3 text-left">Day</th>{((slots ?? []) as Item[]).map((slot) => <th key={slot.id} className="p-3 text-left">{slot.name}</th>)}</tr></thead>
              <tbody>{((days ?? []) as Item[]).map((day) => (
                <tr key={day.id} className="border-t border-border">
                  <th className="p-3 text-left capitalize">{day.day_of_week}</th>
                  {((slots ?? []) as Item[]).map((slot) => {
                    const value = `${day.id}:${slot.id}`;
                    return <td key={slot.id} className="p-3"><label className="inline-flex items-center gap-2"><input type="checkbox" name="availableSlot" value={value} defaultChecked={selected.has(value)} /> Available</label></td>;
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <button type="submit" className="mt-4 h-10 rounded-xl bg-primary px-4 font-semibold text-white">Save teaching availability</button>
          {params.returnTo ? <p className="mt-2 text-xs text-text-muted">After saving, you will return to teaching allocations.</p> : null}
        </form>
      )}
    </div>
  );
}
