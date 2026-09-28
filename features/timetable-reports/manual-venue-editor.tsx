'use client';

import { LoaderCircle, MapPin, Save } from 'lucide-react';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Select } from '@/components/ui/select';

import { updateManualTrainerVenueAction } from './actions';
import { initialManualEntryState, type ManualEntryOptions } from './manual-entry';

export function ManualVenueEditor({ entryId, academicPeriodId, rooms, currentRoomCode }: {
  entryId: string;
  academicPeriodId: string;
  rooms: ManualEntryOptions['rooms'];
  currentRoomCode: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateManualTrainerVenueAction, initialManualEntryState);
  const currentRoomId = rooms.find((room) => room.label.startsWith(`${currentRoomCode} ·`))?.id ?? '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" leadingIcon={<MapPin className="size-3.5" />}>Edit venue</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit manual timetable venue</DialogTitle></DialogHeader>
        <form action={action}>
          <DialogBody className="space-y-4">
            <input type="hidden" name="entryId" value={entryId} />
            <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
            <label className="space-y-1.5 text-sm font-semibold text-text-secondary">Venue
              <Select name="roomId" defaultValue={currentRoomId}>
                <option value="">No room assigned</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.label}</option>)}
              </Select>
            </label>
            {state.message ? <FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} /> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending} leadingIcon={pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}>{pending ? 'Saving…' : 'Save venue'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
