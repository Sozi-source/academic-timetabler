import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

import type {
  ReleaseReadinessCheck,
  ReleaseReadinessSnapshot,
  ReleaseReadinessStatus,
  ReleaseTestCase,
  ReleaseTestCaseResult,
  ReleaseTestOutcome,
  ReleaseTestRequirement,
  ReleaseTestRun,
  ReleaseTestRunStatus,
  ReleaseTestRunWorkspace,
} from './release-types';

type UnknownRow = Record<string, unknown>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readinessSnapshot(value: unknown): ReleaseReadinessSnapshot {
  const root = objectValue(value);
  const rawChecks = Array.isArray(root.checks) ? root.checks : [];

  const checks: ReleaseReadinessCheck[] = rawChecks
    .map((value): ReleaseReadinessCheck | null => {
      const row = objectValue(value);
      const status = stringValue(row.status) as ReleaseReadinessStatus | null;
      const checkKey = stringValue(row.checkKey);

      if (!checkKey || !status) return null;

      return {
        checkKey,
        area: stringValue(row.area) ?? 'System',
        status,
        title: stringValue(row.title) ?? checkKey,
        detail: stringValue(row.detail) ?? '',
        href: stringValue(row.href) ?? '/testing',
      };
    })
    .filter((check): check is ReleaseReadinessCheck => Boolean(check));

  return {
    generatedAt: stringValue(root.generatedAt) ?? new Date(0).toISOString(),
    ready: root.ready === true,
    blockerCount: numberValue(root.blockerCount),
    warningCount: numberValue(root.warningCount),
    checks,
  };
}

function mapRun(row: UnknownRow): ReleaseTestRun | null {
  const id = stringValue(row.id);
  const departmentId = stringValue(row.department_id);
  const departmentName = stringValue(row.department_name_snapshot);
  const suiteVersion = stringValue(row.suite_version);
  const status = stringValue(row.status) as ReleaseTestRunStatus | null;
  const outcome = stringValue(row.outcome) as ReleaseTestOutcome | null;
  const startedAt = stringValue(row.started_at);

  if (!id || !departmentId || !departmentName || !suiteVersion || !status || !outcome || !startedAt) {
    return null;
  }

  return {
    id,
    departmentId,
    departmentName,
    academicPeriodId: stringValue(row.academic_period_id),
    academicPeriodName: stringValue(row.academic_period_name_snapshot),
    suiteVersion,
    status,
    outcome,
    startReadiness: readinessSnapshot(row.start_readiness_snapshot),
    completionReadiness: row.completion_readiness_snapshot
      ? readinessSnapshot(row.completion_readiness_snapshot)
      : null,
    notes: stringValue(row.notes),
    startedAt,
    completedAt: stringValue(row.completed_at),
    cancelledAt: stringValue(row.cancelled_at),
  };
}

export async function getReleaseReadiness(): Promise<ReleaseReadinessSnapshot> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc('get_release_readiness_snapshot');

  if (error) {
    throw new Error(`Unable to load release readiness: ${error.message}`);
  }

  return readinessSnapshot(data);
}

export async function getReleaseTestRuns(limit = 10): Promise<ReleaseTestRun[]> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from('release_test_runs')
    .select(
      'id, department_id, department_name_snapshot, academic_period_id, academic_period_name_snapshot, suite_version, status, outcome, start_readiness_snapshot, completion_readiness_snapshot, notes, started_at, completed_at, cancelled_at',
    )
    .order('started_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)));

  if (error) {
    throw new Error(`Unable to load release test runs: ${error.message}`);
  }

  return ((data ?? []) as UnknownRow[])
    .map(mapRun)
    .filter((run): run is ReleaseTestRun => Boolean(run));
}

export async function getReleaseTestRunWorkspace(
  runId: string,
): Promise<ReleaseTestRunWorkspace | null> {
  const supabase = (await createClient()) as unknown as SupabaseClient;

  const [runResult, caseResult] = await Promise.all([
    supabase
      .from('release_test_runs')
      .select(
        'id, department_id, department_name_snapshot, academic_period_id, academic_period_name_snapshot, suite_version, status, outcome, start_readiness_snapshot, completion_readiness_snapshot, notes, started_at, completed_at, cancelled_at',
      )
      .eq('id', runId)
      .maybeSingle(),
    supabase
      .from('release_test_run_cases')
      .select(
        'id, run_id, case_key, area, title, expected_result, requirement_level, sequence_number, result, note, tested_at',
      )
      .eq('run_id', runId)
      .order('sequence_number', { ascending: true }),
  ]);

  const error = runResult.error ?? caseResult.error;
  if (error) {
    throw new Error(`Unable to load release test run: ${error.message}`);
  }

  if (!runResult.data) return null;

  const run = mapRun(runResult.data as UnknownRow);
  if (!run) return null;

  const cases = ((caseResult.data ?? []) as UnknownRow[])
    .map((row): ReleaseTestCase | null => {
      const id = stringValue(row.id);
      const caseKey = stringValue(row.case_key);
      const area = stringValue(row.area);
      const title = stringValue(row.title);
      const expectedResult = stringValue(row.expected_result);
      const requirementLevel = stringValue(row.requirement_level) as ReleaseTestRequirement | null;
      const result = stringValue(row.result) as ReleaseTestCaseResult | null;

      if (!id || !caseKey || !area || !title || !expectedResult || !requirementLevel || !result) {
        return null;
      }

      return {
        id,
        runId,
        caseKey,
        area,
        title,
        expectedResult,
        requirementLevel,
        sequenceNumber: numberValue(row.sequence_number),
        result,
        note: stringValue(row.note),
        testedAt: stringValue(row.tested_at),
      };
    })
    .filter((testCase): testCase is ReleaseTestCase => Boolean(testCase));

  return { run, cases };
}
