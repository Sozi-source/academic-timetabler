import {
  FormField,
} from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  roomTypeOptions,
} from '@/features/rooms/types';
import type {
  Programme,
} from '@/features/programmes/types';

import {
  unitCategoryOptions,
  type Unit,
  type UnitActionState,
} from './types';

interface UnitFormFieldsProps {
  state: UnitActionState;
  programmes: Programme[];
  unit?: Unit;
  pending: boolean;
}

export function UnitFormFields({
  state,
  programmes,
  unit,
  pending,
}: UnitFormFieldsProps) {
  const programmeError =
    state.fieldErrors?.programmeId?.[0];

  const codeError =
    state.fieldErrors?.code?.[0];

  const nameError =
    state.fieldErrors?.name?.[0];

  const shortNameError =
    state.fieldErrors?.shortName?.[0];

  const categoryError =
    state.fieldErrors?.category?.[0];

  const periodError =
    state.fieldErrors?.academicPeriodNumber?.[0];

  const theoryHoursError =
    state.fieldErrors?.theoryHours?.[0];

  const practicalHoursError =
    state.fieldErrors?.practicalHours?.[0];

  const weeklySessionsError =
    state.fieldErrors?.weeklySessions?.[0];

  const preferredRoomTypeError =
    state.fieldErrors?.preferredRoomType?.[0];

  const notesError =
    state.fieldErrors?.notes?.[0];

  return (
    <>
      <FormField
        id="unit-programme"
        label="Programme"
        required
        error={programmeError}
      >
        <Select
          id="unit-programme"
          name="programmeId"
          required
          disabled={pending}
          defaultValue={
            unit?.programmeId ?? ''
          }
          hasError={Boolean(programmeError)}
        >
          <option value="" disabled>
            Select programme
          </option>

          {programmes.map((programme) => (
            <option
              key={programme.id}
              value={programme.id}
            >
              {programme.code} - {programme.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="unit-code"
          label="Unit code"
          required
          error={codeError}
        >
          <Input
            id="unit-code"
            name="code"
            required
            maxLength={60}
            disabled={pending}
            defaultValue={unit?.code ?? ''}
            hasError={Boolean(codeError)}
          />
        </FormField>

        <FormField
          id="unit-short-name"
          label="Short name"
          optional
          error={shortNameError}
        >
          <Input
            id="unit-short-name"
            name="shortName"
            maxLength={80}
            disabled={pending}
            defaultValue={unit?.shortName ?? ''}
            hasError={Boolean(shortNameError)}
          />
        </FormField>
      </div>

      <FormField
        id="unit-name"
        label="Unit name"
        required
        error={nameError}
      >
        <Input
          id="unit-name"
          name="name"
          required
          maxLength={180}
          disabled={pending}
          defaultValue={unit?.name ?? ''}
          hasError={Boolean(nameError)}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="unit-category"
          label="Category"
          required
          error={categoryError}
        >
          <Select
            id="unit-category"
            name="category"
            required
            disabled={pending}
            defaultValue={
              unit?.category ?? 'core'
            }
            hasError={Boolean(categoryError)}
          >
            {unitCategoryOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          id="unit-period-number"
          label="Programme stage (Period number)"
          required
          error={periodError}
        >
          <Input
            id="unit-period-number"
            name="academicPeriodNumber"
            type="number"
            min={1}
            max={60}
            required
            disabled={pending}
            defaultValue={
              unit?.academicPeriodNumber ?? 1
            }
            hasError={Boolean(periodError)}
          />
        </FormField>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-surface-subtle p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Teaching structure
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Define the weekly teaching requirement and room needs for the generator.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            id="unit-theory-hours"
            label="Theory hours"
            required
            error={theoryHoursError}
          >
            <Input
              id="unit-theory-hours"
              name="theoryHours"
              type="number"
              min={0}
              max={100}
              step={0.5}
              required
              disabled={pending}
              defaultValue={unit?.theoryHours ?? 0}
              hasError={Boolean(
                theoryHoursError,
              )}
            />
          </FormField>

          <FormField
            id="unit-practical-hours"
            label="Practical hours"
            required
            error={practicalHoursError}
          >
            <Input
              id="unit-practical-hours"
              name="practicalHours"
              type="number"
              min={0}
              max={100}
              step={0.5}
              required
              disabled={pending}
              defaultValue={
                unit?.practicalHours ?? 0
              }
              hasError={Boolean(
                practicalHoursError,
              )}
            />
          </FormField>

          <FormField
            id="unit-weekly-sessions"
            label="Weekly sessions"
            required
            error={weeklySessionsError}
          >
            <Input
              id="unit-weekly-sessions"
              name="weeklySessions"
              type="number"
              min={1}
              max={20}
              required
              disabled={pending}
              defaultValue={
                unit?.weeklySessions ?? 1
              }
              hasError={Boolean(
                weeklySessionsError,
              )}
            />
          </FormField>
        </div>

        <FormField
          id="unit-preferred-room"
          label="Preferred room type"
          optional
          error={preferredRoomTypeError}
        >
          <Select
            id="unit-preferred-room"
            name="preferredRoomType"
            disabled={pending}
            defaultValue={
              unit?.preferredRoomType ?? ''
            }
            hasError={Boolean(
              preferredRoomTypeError,
            )}
          >
            <option value="">
              No room preference
            </option>

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
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface-subtle p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Timetable and status
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Configure timetable scheduling availability and active status for this unit.
          </p>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-text-primary">
            <input
              type="checkbox"
              name="isTimetableAvailable"
              value="true"
              disabled={pending}
              defaultChecked={unit ? unit.isTimetableAvailable : true}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
            Available for Timetable scheduling
          </label>

          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-text-primary">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              disabled={pending}
              defaultChecked={unit ? unit.isActive : true}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
            Active unit
          </label>
        </div>
      </section>

      <FormField
        id="unit-notes"
        label="Notes"
        optional
        error={notesError}
      >
        <Textarea
          id="unit-notes"
          name="notes"
          rows={4}
          maxLength={1500}
          disabled={pending}
          defaultValue={unit?.notes ?? ''}
          hasError={Boolean(notesError)}
        />
      </FormField>
    </>
  );
}