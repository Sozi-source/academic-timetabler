import { Checkbox } from '@/components/ui/checkbox';
import {
  FormField,
} from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  roomTypeOptions,
  type Room,
  type RoomActionState,
} from './types';

interface RoomFormFieldsProps {
  state: RoomActionState;
  room?: Room;
  pending: boolean;
}

export function RoomFormFields({
  state,
  room,
  pending,
}: RoomFormFieldsProps) {
  const codeError =
    state.fieldErrors?.code?.[0];

  const nameError =
    state.fieldErrors?.name?.[0];

  const roomTypeError =
    state.fieldErrors?.roomType?.[0];

  const buildingError =
    state.fieldErrors?.building?.[0];

  const floorLabelError =
    state.fieldErrors?.floorLabel?.[0];

  const capacityError =
    state.fieldErrors?.capacity?.[0];

  const notesError =
    state.fieldErrors?.notes?.[0];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="room-code"
          label="Room code"
          required
          error={codeError}
        >
          <Input
            id="room-code"
            name="code"
            required
            disabled={pending}
            defaultValue={room?.code ?? ''}
            hasError={Boolean(codeError)}
          />
        </FormField>

        <FormField
          id="room-type"
          label="Room type"
          required
          error={roomTypeError}
        >
          <Select
            id="room-type"
            name="roomType"
            required
            disabled={pending}
            defaultValue={
              room?.roomType ??
              'lecture_room'
            }
            hasError={Boolean(roomTypeError)}
          >
            {roomTypeOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        id="room-name"
        label="Official room name"
        required
        error={nameError}
      >
        <Input
          id="room-name"
          name="name"
          required
          disabled={pending}
          defaultValue={room?.name ?? ''}
          hasError={Boolean(nameError)}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="room-building"
          label="Building"
          optional
          error={buildingError}
        >
          <Input
            id="room-building"
            name="building"
            disabled={pending}
            defaultValue={room?.building ?? ''}
            hasError={Boolean(buildingError)}
          />
        </FormField>

        <FormField
          id="room-floor"
          label="Floor"
          optional
          error={floorLabelError}
        >
          <Input
            id="room-floor"
            name="floorLabel"
            disabled={pending}
            defaultValue={room?.floorLabel ?? ''}
            hasError={Boolean(floorLabelError)}
          />
        </FormField>
      </div>

      <FormField
        id="room-capacity"
        label="Seating capacity"
        required
        error={capacityError}
      >
        <Input
          id="room-capacity"
          name="capacity"
          type="number"
          min={1}
          max={1000}
          required
          disabled={pending}
          defaultValue={room?.capacity ?? ''}
          hasError={Boolean(capacityError)}
        />
      </FormField>

      <div className="grid gap-3 rounded-xl border border-border-soft bg-surface-subtle p-4">
        <label className="flex items-start gap-3">
          <Checkbox
            name="isAccessible"
            defaultChecked={
              room?.isAccessible ?? false
            }
            disabled={pending}
          />

          <span>
            <span className="block text-sm font-semibold text-text-primary">
              Accessible room
            </span>

            <span className="mt-1 block text-xs leading-5 text-text-muted">
              Suitable for learners and staff with
              mobility or accessibility requirements.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <Checkbox
            name="isTimetableAvailable"
            defaultChecked={
              room?.isTimetableAvailable ??
              true
            }
            disabled={pending}
          />

          <span>
            <span className="block text-sm font-semibold text-text-primary">
              Available for timetabling
            </span>

            <span className="mt-1 block text-xs leading-5 text-text-muted">
              Allow this room to be selected during
              timetable generation and allocation.
            </span>
          </span>
        </label>
      </div>

      <FormField
        id="room-notes"
        label="Notes"
        optional
        error={notesError}
      >
        <Textarea
          id="room-notes"
          name="notes"
          rows={4}
          maxLength={1000}
          disabled={pending}
          defaultValue={room?.notes ?? ''}
          hasError={Boolean(notesError)}
        />
      </FormField>
    </>
  );
}