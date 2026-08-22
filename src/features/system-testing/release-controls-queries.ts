import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  ReleaseDefect,
  ReleaseDefectSeverity,
  ReleaseDefectStatus,
  ReleaseGoLiveStatus,
  ReleaseSignoff,
  ReleaseSignoffStatus,
} from './release-controls-types';

type UnknownRow =
  Record<string, unknown>;

function asString(
  value: unknown,
): string | null {
  return typeof value === 'string'
    ? value
    : null;
}

function asNumber(
  value: unknown,
): number {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function asObject(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function getReleaseDefects(
  limit = 200,
): Promise<ReleaseDefect[]> {
  const supabase =
    (await createClient()) as unknown as SupabaseClient;

  const {
    data,
    error,
  } = await supabase.rpc(
    'get_release_test_defects',
    {
      target_limit: limit,
    },
  );

  if (error) {
    throw new Error(
      `Unable to load release defects: ${error.message}`,
    );
  }

  return ((data ?? []) as UnknownRow[])
    .map((row): ReleaseDefect | null => {
      const id = asString(row.id);
      const severity = asString(row.severity) as ReleaseDefectSeverity | null;
      const status = asString(row.status) as ReleaseDefectStatus | null;
      const title = asString(row.title);
      const description = asString(row.description);
      const createdAt = asString(row.created_at);
      const updatedAt = asString(row.updated_at);

      if (
        !id ||
        !severity ||
        !status ||
        !title ||
        !description ||
        !createdAt ||
        !updatedAt
      ) {
        return null;
      }

      return {
        id,
        defectNumber: asNumber(row.defect_number),
        runId: asString(row.run_id),
        caseKey: asString(row.case_key),
        suiteVersion: asString(row.suite_version),
        severity,
        status,
        title,
        description,
        resolutionNote: asString(row.resolution_note),
        createdAt,
        updatedAt,
      };
    })
    .filter((item): item is ReleaseDefect => Boolean(item));
}

export async function getReleaseGoLiveStatus(): Promise<ReleaseGoLiveStatus> {
  const supabase =
    (await createClient()) as unknown as SupabaseClient;

  const {
    data,
    error,
  } = await supabase.rpc(
    'get_release_go_live_status',
  );

  if (error) {
    throw new Error(
      `Unable to load go-live status: ${error.message}`,
    );
  }

  const root = asObject(data);
  const latestRun = asObject(root.latestPassedRun);
  const activeSignoff = asObject(root.activeSignoff);

  return {
    eligible: root.eligible === true,
    signoffValid: root.signoffValid === true,
    blockerDefects: asNumber(root.blockerDefects),
    warningDefects: asNumber(root.warningDefects),
    activeCatalogCaseCount: asNumber(root.activeCatalogCaseCount),
    passedRunCaseCount: asNumber(root.passedRunCaseCount),
    reasons: Array.isArray(root.reasons)
      ? root.reasons.filter((value): value is string => typeof value === 'string')
      : [],
    latestPassedRun: asString(latestRun.id)
      ? {
          id: asString(latestRun.id) as string,
          suiteVersion: asString(latestRun.suiteVersion) ?? '—',
          completedAt: asString(latestRun.completedAt),
        }
      : null,
    activeSignoff: asString(activeSignoff.id)
      ? {
          id: asString(activeSignoff.id) as string,
          verificationRef: asString(activeSignoff.verificationRef) ?? '—',
          approvedAt: asString(activeSignoff.approvedAt) ?? '',
        }
      : null,
  };
}

export async function getReleaseSignoffs(
  limit = 30,
): Promise<ReleaseSignoff[]> {
  const supabase =
    (await createClient()) as unknown as SupabaseClient;

  const {
    data,
    error,
  } = await supabase.rpc(
    'get_release_signoffs',
    {
      target_limit: limit,
    },
  );

  if (error) {
    throw new Error(
      `Unable to load release sign-offs: ${error.message}`,
    );
  }

  return ((data ?? []) as UnknownRow[])
    .map((row): ReleaseSignoff | null => {
      const id = asString(row.id);
      const suiteVersion = asString(row.suite_version);
      const releaseTestRunId = asString(row.release_test_run_id);
      const verificationRef = asString(row.verification_ref);
      const status = asString(row.status) as ReleaseSignoffStatus | null;
      const approvedAt = asString(row.approved_at);

      if (
        !id ||
        !suiteVersion ||
        !releaseTestRunId ||
        !verificationRef ||
        !status ||
        !approvedAt
      ) {
        return null;
      }

      return {
        id,
        suiteVersion,
        releaseTestRunId,
        verificationRef,
        status,
        note: asString(row.note),
        approvedAt,
        revokedAt: asString(row.revoked_at),
        revokeReason: asString(row.revoke_reason),
      };
    })
    .filter((item): item is ReleaseSignoff => Boolean(item));
}
