'use client';

import {
  LoaderCircle,
  Link2,
} from 'lucide-react';
import {
  useActionState,
} from 'react';

import {
  provisionTrainerAccessAction,
} from './actions';
import {
  initialTrainerAccessActionState,
} from './types';

export function TrainerAccessAction({
  trainerId,
}: {
  trainerId: string;
}) {
  const [
    state,
    formAction,
    pending,
  ] =
    useActionState(
      provisionTrainerAccessAction,
      initialTrainerAccessActionState,
    );

  return (
    <div className="space-y-1.5">
      <form
        action={
          formAction
        }
      >
        <input
          type="hidden"
          name="trainerId"
          value={
            trainerId
          }
        />

        <button
          type="submit"
          disabled={
            pending
          }
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-header-blue px-3 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <LoaderCircle
              className="size-3 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Link2
              className="size-3"
              aria-hidden="true"
            />
          )}

          {pending
            ? 'Linking'
            : 'Link access'}
        </button>
      </form>

      {state.message ? (
        <p
          className={
            state.status ===
            'error'
              ? 'max-w-48 text-[10px] leading-4 text-red-700'
              : 'max-w-48 text-[10px] leading-4 text-text-muted'
          }
        >
          {
            state.message
          }
        </p>
      ) : null}
    </div>
  );
}
