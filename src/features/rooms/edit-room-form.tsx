'use client';

import {
  LoaderCircle,
  Save,
} from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';

import { updateRoomAction } from './actions';
import { RoomFormFields } from './room-form-fields';
import {
  initialRoomActionState,
  type Room,
} from './types';

interface EditRoomFormProps {
  room: Room;
}

export function EditRoomForm({
  room,
}: EditRoomFormProps) {
  const [state, formAction, pending] =
    useActionState(
      updateRoomAction,
      initialRoomActionState,
    );

  return (
    <form
      action={formAction}
      className="space-y-5"
      noValidate
    >
      <input
        type="hidden"
        name="id"
        value={room.id}
      />

      {!room.isActive ? (
        <FormStatusMessage
          status="warning"
          title="Inactive room"
          message="This room remains available for historical records but cannot be used for timetable scheduling until it is reactivated."
        />
      ) : null}

      {state.message ? (
        <FormStatusMessage
          status={
            state.status === 'success'
              ? 'success'
              : 'error'
          }
          message={state.message}
        />
      ) : null}

      <RoomFormFields
        state={state}
        room={room}
        pending={pending}
      />

      <div className="flex justify-end border-t border-border-soft pt-5">
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          leadingIcon={
            pending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save
                className="size-4"
                aria-hidden="true"
              />
            )
          }
        >
          {pending
            ? 'Saving changes'
            : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}