import {
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

import type {
  GeneratorPreview,
} from './server-types';

export function GeneratorReadiness({
  preview,
}: {
  preview: GeneratorPreview;
}) {
  const {
    readiness,
  } = preview;

  return (
    <section
      className={
        readiness.isReady
          ? 'rounded-2xl border border-success-border bg-success-surface p-5'
          : 'rounded-2xl border border-warning-border bg-warning-surface p-5'
      }
    >
      <div className="flex items-start gap-3">
        {readiness.isReady ? (
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-success"
            aria-hidden="true"
          />
        ) : (
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-warning"
            aria-hidden="true"
          />
        )}

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-text-primary">
            {readiness.isReady
              ? 'Generator configuration ready'
              : 'Generator configuration incomplete'}
          </h2>

          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {readiness.isReady
              ? 'All required timetable resources were found for the selected Academic Period.'
              : 'Resolve the listed configuration issues before generating a complete timetable.'}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="neutral">
              {readiness.allocationCount}{' '}
              allocation
              {readiness.allocationCount === 1
                ? ''
                : 's'}
            </Badge>

            <Badge variant="neutral">
              {readiness.workingDayCount}{' '}
              working day
              {readiness.workingDayCount === 1
                ? ''
                : 's'}
            </Badge>

            <Badge variant="neutral">
              {readiness.teachingSlotCount}{' '}
              teaching slot
              {readiness.teachingSlotCount === 1
                ? ''
                : 's'}
            </Badge>

            <Badge variant="neutral">
              {readiness.trainerCount}{' '}
              trainer
              {readiness.trainerCount === 1
                ? ''
                : 's'}
            </Badge>

            <Badge variant="neutral">
              {readiness.roomCount}{' '}
              room
              {readiness.roomCount === 1
                ? ''
                : 's'}
            </Badge>

            <Badge variant="neutral">
              {readiness.existingSessionCount}{' '}
              existing session
              {readiness.existingSessionCount === 1
                ? ''
                : 's'}
            </Badge>
          </div>

          {readiness.issues.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-text-secondary">
              {readiness.issues.map(
                (issue) => (
                  <li
                    key={issue}
                    className="flex gap-2"
                  >
                    <span aria-hidden="true">
                      •
                    </span>
                    <span>{issue}</span>
                  </li>
                ),
              )}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}