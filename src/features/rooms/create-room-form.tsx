'use client';

import {
  Building2,
  LoaderCircle,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useRef,
} from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';

import { createRoomAction } from './actions';
import { RoomFormFields } from './room-form-fields';
import {
  initialRoomActionState,
} from './types';

export function CreateRoomForm() {
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, pending] =
    useActionState(
      createRoomAction,
      initialRoomActionState,
    );

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-5"
      noValidate
    >
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
              <Building2
                className="size-4"
                aria-hidden="true"
              />
            )
          }
        >
          {pending
            ? 'Creating room'
            : 'Create room'}
        </Button>
      </div>
    </form>
  );
}