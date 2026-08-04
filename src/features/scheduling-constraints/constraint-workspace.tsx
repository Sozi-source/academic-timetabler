import type { ReactNode } from 'react';
import { Ban, CalendarClock, CheckCircle2, Trash2 } from 'lucide-react';
import { createSchedulingConstraintAction, deleteSchedulingConstraintAction, toggleSchedulingConstraintAction } from './actions';
import type { SchedulingConstraintData } from './types';

const subjectLabels = { trainer: 'Trainer', room: 'Room', cohort: 'Cohort', institution: 'Institution' } as const;
const typeLabels = { unavailable: 'Unavailable', preferred: 'Preferred', required: 'Required', protected_day: 'Protected day' } as const;

export function ConstraintWorkspace({ academicPeriodId, data }: { academicPeriodId: string; data: SchedulingConstraintData }) {
  const activeCount = data.constraints.filter((item) => item.isActive).length;
  const hardCount = data.constraints.filter((item) => item.isActive && item.priority === 'hard').length;
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">
      <Metric label="Active constraints" value={activeCount} />
      <Metric label="Hard constraints" value={hardCount} />
      <Metric label="Soft preferences" value={activeCount - hardCount} />
    </div>

    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3"><CalendarClock className="size-5 text-primary"/><div><h2 className="font-semibold text-text-primary">Add scheduling constraint</h2><p className="text-sm text-text-muted">Record availability, protected days and scheduling preferences.</p></div></div>
      <form action={createSchedulingConstraintAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="academicPeriodId" value={academicPeriodId}/>
        <Field label="Applies to"><select name="subjectType" className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm" defaultValue="trainer"><option value="trainer">Trainer</option><option value="room">Room</option><option value="cohort">Cohort</option><option value="institution">Institution-wide</option></select></Field>
        <Field label="Record"><select name="subjectId" className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm" defaultValue=""><option value="">Select record</option><optgroup label="Trainers">{data.trainers.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup><optgroup label="Rooms">{data.rooms.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup><optgroup label="Cohorts">{data.cohorts.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup></select></Field>
        <Field label="Constraint"><select name="constraintType" className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm"><option value="unavailable">Unavailable</option><option value="preferred">Preferred</option><option value="required">Required</option><option value="protected_day">Protected day</option></select></Field>
        <Field label="Priority"><select name="priority" className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm"><option value="hard">Hard — must obey</option><option value="soft">Soft — optimize</option></select></Field>
        <Field label="Working day"><select name="workingDayId" className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm" defaultValue=""><option value="">Any day</option>{data.workingDays.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        <Field label="Start time"><input name="startsAt" type="time" className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm" /></Field>
        <Field label="End time"><input name="endsAt" type="time" className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm" /></Field>
        <Field label="Reason"><input name="reason" required minLength={3} maxLength={500} className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm" placeholder="e.g. Clinical rotation" /></Field>
        <div className="md:col-span-2 xl:col-span-4 flex justify-end"><button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">Save constraint</button></div>
      </form>
    </section>

    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border p-5"><h2 className="font-semibold text-text-primary">Constraint register</h2><p className="text-sm text-text-muted">Hard constraints block invalid placements. Soft constraints influence timetable scoring.</p></div>
      {data.constraints.length === 0 ? <div className="p-10 text-center text-sm text-text-muted">No constraints have been configured for this Academic Period.</div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-surface-subtle text-text-secondary"><tr><Th>Subject</Th><Th>Rule</Th><Th>When</Th><Th>Priority</Th><Th>Reason</Th><Th>Actions</Th></tr></thead><tbody>{data.constraints.map((item)=><tr key={item.id} className="border-t border-border"><Td><div className="font-medium text-text-primary">{item.subjectLabel}</div><div className="text-xs text-text-muted">{subjectLabels[item.subjectType]}</div></Td><Td>{typeLabels[item.constraintType]}</Td><Td>{item.workingDayLabel ?? 'Any day'}{item.startsAt && item.endsAt ? <div className="text-xs text-text-muted">{item.startsAt.slice(0,5)}–{item.endsAt.slice(0,5)}</div> : null}</Td><Td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.priority === 'hard' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>{item.priority}</span></Td><Td className="max-w-xs">{item.reason}</Td><Td><div className="flex gap-2"><form action={toggleSchedulingConstraintAction}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="isActive" value={String(!item.isActive)}/><button className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold">{item.isActive ? <><Ban className="mr-1 inline size-3"/>Disable</> : <><CheckCircle2 className="mr-1 inline size-3"/>Enable</>}</button></form><form action={deleteSchedulingConstraintAction}><input type="hidden" name="id" value={item.id}/><button aria-label="Delete constraint" className="rounded-lg border border-danger/30 px-2.5 py-1.5 text-danger"><Trash2 className="size-3.5"/></button></form></div></Td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function Metric({label,value}:{label:string;value:number}) { return <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm"><div className="text-2xl font-bold text-text-primary">{value}</div><div className="mt-1 text-sm text-text-muted">{label}</div></div>; }
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="text-sm font-semibold text-text-primary">{label}<div className="mt-2">{children}</div></label>; }
function Th({children}:{children:ReactNode}) { return <th className="px-4 py-3 font-semibold">{children}</th>; }
function Td({children,className=''}:{children:ReactNode;className?:string}) { return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>; }
