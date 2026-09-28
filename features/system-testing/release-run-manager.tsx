'use client';

import { Ban, Check, CheckCircle2, LoaderCircle, Save, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import {
  canCompleteReleaseRun,
  releaseCaseNeedsNote,
  releaseCaseResultLabel,
  releaseCaseResultVariant,
  releaseCaseSummary,
  releaseRequirementLabel,
} from './release-domain';
import type { ReleaseTestCase, ReleaseTestCaseResult, ReleaseTestRun } from './release-types';

interface LocalCaseState {
  result: ReleaseTestCaseResult;
  note: string;
}

export function ReleaseRunManager({
  run,
  cases,
}: {
  run: ReleaseTestRun;
  cases: ReleaseTestCase[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, LocalCaseState>>(
    Object.fromEntries(
      cases.map((testCase) => [
        testCase.caseKey,
        { result: testCase.result, note: testCase.note ?? '' },
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentCases = useMemo(
    () =>
      cases.map((testCase) => ({
        ...testCase,
        result: values[testCase.caseKey]?.result ?? testCase.result,
        note: values[testCase.caseKey]?.note ?? testCase.note,
      })),
    [cases, values],
  );

  const summary = releaseCaseSummary(currentCases);
  const canComplete = canCompleteReleaseRun(run, currentCases);
  const editable = run.status === 'in_progress';

  async function saveCase(testCase: ReleaseTestCase) {
    const local = values[testCase.caseKey];
    if (!local) return;

    if (releaseCaseNeedsNote(local.result) && !local.note.trim()) {
      setError(
        `${testCase.caseKey}: add a note for ${releaseCaseResultLabel(local.result).toLowerCase()}.`,
      );
      return;
    }

    setBusy(`case:${testCase.caseKey}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/testing/runs/${run.id}/cases/${encodeURIComponent(testCase.caseKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ result: local.result, note: local.note }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Test result could not be saved.');
        return;
      }

      setMessage(`${testCase.caseKey} saved.`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function complete() {
    if (!canComplete) {
      setError('Resolve every test case before completing this run.');
      return;
    }

    setBusy('complete');
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/testing/runs/${run.id}/complete`, { method: 'POST' });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Release test run could not be completed.');
        return;
      }

      setMessage(
        payload?.outcome === 'passed'
          ? 'Release test run passed.'
          : 'Release test run completed with blockers or failures.',
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy('cancel');
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/testing/runs/${run.id}/cancel`, { method: 'POST' });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Release test run could not be cancelled.');
        return;
      }

      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['Cases', summary.total, 'neutral'],
          ['Pass', summary.passed, 'success'],
          ['Fail', summary.failed, 'danger'],
          ['Blocked', summary.blocked, 'warning'],
          ['Pending', summary.pending, 'neutral'],
        ].map(([label, value, variant]) => (
          <div key={label} className="rounded-xl border border-border bg-white px-3 py-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted">{label}</p>
            <div className="mt-1">
              <Badge variant={variant as 'neutral' | 'success' | 'danger' | 'warning'}>
                {value}
              </Badge>
            </div>
          </div>
        ))}
      </section>

      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-success">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {message}
        </p>
      ) : null}

      <section className="space-y-3">
        {currentCases.map((testCase) => {
          const local = values[testCase.caseKey];
          const selected = local?.result ?? testCase.result;
          const note = local?.note ?? testCase.note ?? '';
          const caseBusy = busy === `case:${testCase.caseKey}`;

          return (
            <article key={testCase.caseKey} className="rounded-xl border border-border bg-white px-4 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{testCase.caseKey}</Badge>
                    <Badge
                      variant={
                        testCase.requirementLevel === 'critical'
                          ? 'danger'
                          : testCase.requirementLevel === 'required'
                            ? 'institutional'
                            : 'neutral'
                      }
                    >
                      {releaseRequirementLabel(testCase.requirementLevel)}
                    </Badge>
                    <Badge variant={releaseCaseResultVariant(selected)}>
                      {releaseCaseResultLabel(selected)}
                    </Badge>
                    <span className="text-[10px] font-semibold text-text-muted">{testCase.area}</span>
                  </div>

                  <h2 className="mt-2 text-sm font-bold text-text-primary">{testCase.title}</h2>
                  <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                    {testCase.expectedResult}
                  </p>
                </div>

                {editable ? (
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {(
                      [
                        ['pass', 'Pass', Check],
                        ['fail', 'Fail', X],
                        ['blocked', 'Blocked', Ban],
                      ] as const
                    ).map(([result, label, Icon]) => (
                      <button
                        key={result}
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          setValues((current) => ({
                            ...current,
                            [testCase.caseKey]: {
                              result,
                              note: current[testCase.caseKey]?.note ?? '',
                            },
                          }))
                        }
                        className={
                          selected === result
                            ? 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary bg-primary px-2.5 text-[10px] font-bold text-white'
                            : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[10px] font-semibold text-text-secondary transition hover:bg-surface-subtle'
                        }
                      >
                        <Icon className="size-3" aria-hidden="true" />
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    Evidence / note{releaseCaseNeedsNote(selected) ? ' · Required' : ''}
                  </label>
                  <Textarea
                    rows={2}
                    maxLength={2000}
                    disabled={!editable || busy !== null}
                    value={note}
                    placeholder={
                      releaseCaseNeedsNote(selected)
                        ? 'Describe the failure or blocker.'
                        : 'Optional test evidence.'
                    }
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [testCase.caseKey]: {
                          result: current[testCase.caseKey]?.result ?? testCase.result,
                          note: event.target.value,
                        },
                      }))
                    }
                  />
                </div>

                {editable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void saveCase(testCase)}
                    leadingIcon={
                      caseBusy ? (
                        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <Save className="size-3" aria-hidden="true" />
                      )
                    }
                  >
                    Save case
                  </Button>
                ) : null}
              </div>

              {selected === 'fail' || selected === 'blocked' ? (
                <Link
                  href={`/testing/defects?runId=${run.id}&caseKey=${encodeURIComponent(testCase.caseKey)}`}
                  className="mt-2 inline-flex text-[10px] font-semibold text-primary hover:underline"
                >
                  Log linked defect
                </Link>
              ) : null}
            </article>
          );
        })}
      </section>

      {editable ? (
        <section className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void cancel()}
            leadingIcon={
              busy === 'cancel' ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Ban className="size-3.5" aria-hidden="true" />
              )
            }
          >
            Cancel run
          </Button>

          <Button
            type="button"
            disabled={busy !== null || !canComplete}
            onClick={() => void complete()}
            leadingIcon={
              busy === 'complete' ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
              )
            }
          >
            Complete run
          </Button>
        </section>
      ) : null}
    </div>
  );
}
