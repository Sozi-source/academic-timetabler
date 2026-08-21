'use client';

import {
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import {
  CheckCircle2,
  Send,
  Settings2,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

import {
  canFinaliseAssessment,
  canPublishAssessment,
  validateAssessmentRule,
} from './assessment-rule-domain';

function numberText(
  value: number | null,
): string {
  return value ===
    null
    ? ''
    : String(
        value,
      );
}

export function AssessmentRuleReleaseControls({
  assessmentId,
  maximumMark,
  passMark,
  workflowStatus,
  published,
}: {
  assessmentId: string;
  maximumMark: number | null;
  passMark: number | null;
  workflowStatus: string;
  published: boolean;
}) {
  const router =
    useRouter();

  const [
    maximumText,
    setMaximumText,
  ] =
    useState(
      numberText(
        maximumMark,
      ),
    );

  const [
    passText,
    setPassText,
  ] =
    useState(
      numberText(
        passMark,
      ),
    );

  const [
    busy,
    setBusy,
  ] =
    useState<
      'rule'
      | 'finalise'
      | 'publish'
      | null
    >(null);

  const ruleConfigured =
    maximumMark !==
      null &&
    passMark !==
      null;

  const ruleLocked =
    published ||
    workflowStatus ===
      'finalised' ||
    workflowStatus ===
      'archived';

  const canFinalise =
    canFinaliseAssessment({
      workflowStatus,
      published,
      ruleConfigured,
    });

  const canPublish =
    canPublishAssessment({
      workflowStatus,
      published,
    });

  async function saveRule() {
    const nextMaximum =
      Number(
        maximumText,
      );

    const nextPass =
      Number(
        passText,
      );

    const error =
      validateAssessmentRule({
        maximumMark:
          Number.isFinite(
            nextMaximum,
          )
            ? nextMaximum
            : null,
        passMark:
          Number.isFinite(
            nextPass,
          )
            ? nextPass
            : null,
      });

    if (error) {
      window.alert(
        error,
      );

      return;
    }

    setBusy(
      'rule',
    );

    try {
      const response =
        await fetch(
          `/api/assessment/rules/${assessmentId}`,
          {
            method:
              'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                maximumMark:
                  nextMaximum,
                passMark:
                  nextPass,
              }),
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (
        !response.ok
      ) {
        window.alert(
          payload?.message ??
            'Assessment rule could not be saved.',
        );

        return;
      }

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function runTransition(
    type:
      | 'finalise'
      | 'publish',
  ) {
    const label =
      type ===
      'finalise'
        ? 'Finalise these assessment results?'
        : 'Publish these finalised results?';

    if (
      !window.confirm(
        label,
      )
    ) {
      return;
    }

    setBusy(
      type,
    );

    try {
      const response =
        await fetch(
          `/api/assessment/${type}/${assessmentId}`,
          {
            method:
              'POST',
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (
        !response.ok
      ) {
        window.alert(
          payload?.message ??
            (
              type ===
              'finalise'
                ? 'Assessment could not be finalised.'
                : 'Assessment could not be published.'
            ),
        );

        return;
      }

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">
              Assessment rule
            </h2>

            {published ? (
              <Badge variant="success">
                Published
              </Badge>
            ) : (
              <Badge variant="neutral">
                {
                  workflowStatus
                }
              </Badge>
            )}
          </div>

          <p className="mt-1 text-[11px] text-text-muted">
            Maximum and pass marks apply
            to this unit, Academic Period
            and assessment type.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="block">
              <span className="text-[10px] font-semibold text-text-muted">
                Maximum mark
              </span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={
                  maximumText
                }
                onChange={(
                  event,
                ) =>
                  setMaximumText(
                    event.target.value,
                  )
                }
                disabled={
                  ruleLocked ||
                  busy !==
                    null
                }
                className="mt-1 h-9 w-28 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary disabled:bg-surface-subtle"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-semibold text-text-muted">
                Pass mark
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  passText
                }
                onChange={(
                  event,
                ) =>
                  setPassText(
                    event.target.value,
                  )
                }
                disabled={
                  ruleLocked ||
                  busy !==
                    null
                }
                className="mt-1 h-9 w-28 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary disabled:bg-surface-subtle"
              />
            </label>

            {!ruleLocked ? (
              <button
                type="button"
                onClick={() =>
                  void saveRule()
                }
                disabled={
                  busy !==
                  null
                }
                className="mt-5 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Settings2
                  className="size-3.5"
                  aria-hidden="true"
                />

                {busy ===
                'rule'
                  ? 'Saving...'
                  : 'Save rule'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canFinalise ? (
            <button
              type="button"
              onClick={() =>
                void runTransition(
                  'finalise',
                )
              }
              disabled={
                busy !==
                null
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2
                className="size-3.5"
                aria-hidden="true"
              />

              {busy ===
              'finalise'
                ? 'Finalising...'
                : 'Finalise'}
            </button>
          ) : null}

          {canPublish ? (
            <button
              type="button"
              onClick={() =>
                void runTransition(
                  'publish',
                )
              }
              disabled={
                busy !==
                  null
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-header-blue px-3.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send
                className="size-3.5"
                aria-hidden="true"
              />

              {busy ===
              'publish'
                ? 'Publishing...'
                : 'Publish'}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
