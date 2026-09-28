import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  DeploymentEnvironment,
  DeploymentStatus,
  ProductionIncident,
  ProductionIncidentSeverity,
  ProductionIncidentStatus,
  ReleaseDeployment,
} from './types';

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
  const result = Number(value ?? 0);
  return Number.isFinite(result)
    ? result
    : 0;
}

async function client():
Promise<SupabaseClient> {
  return (
    await createClient()
  ) as unknown as SupabaseClient;
}

export async function getReleaseDeployments(
  limit = 100,
): Promise<ReleaseDeployment[]> {
  const supabase = await client();
  const { data, error } = await supabase.rpc(
    'get_release_deployments',
    {
      target_limit: limit,
    },
  );

  if (error) {
    throw new Error(
      `Unable to load deployment history: ${error.message}`,
    );
  }

  return ((data ?? []) as UnknownRow[])
    .map((row): ReleaseDeployment | null => {
      const id = asString(row.id);
      const environment = asString(row.environment) as DeploymentEnvironment | null;
      const releaseTestRunId = asString(row.release_test_run_id);
      const suiteVersion = asString(row.suite_version);
      const versionLabel = asString(row.version_label);
      const status = asString(row.status) as DeploymentStatus | null;
      const deployedAt = asString(row.deployed_at);

      if (
        !id ||
        !environment ||
        !releaseTestRunId ||
        !suiteVersion ||
        !versionLabel ||
        !status ||
        !deployedAt
      ) {
        return null;
      }

      return {
        id,
        environment,
        versionLabel,
        releaseSignoffId: asString(row.release_signoff_id),
        releaseTestRunId,
        suiteVersion,
        verificationRef: asString(row.verification_ref),
        status,
        note: asString(row.note),
        deployedAt,
        deployedByName: asString(row.deployed_by_name),
        rolledBackAt: asString(row.rolled_back_at),
        rollbackReason: asString(row.rollback_reason),
      };
    })
    .filter((item): item is ReleaseDeployment => Boolean(item));
}

export async function getProductionIncidents(
  limit = 300,
): Promise<ProductionIncident[]> {
  const supabase = await client();
  const { data, error } = await supabase.rpc(
    'get_production_incidents',
    {
      target_limit: limit,
    },
  );

  if (error) {
    throw new Error(
      `Unable to load operational incidents: ${error.message}`,
    );
  }

  return ((data ?? []) as UnknownRow[])
    .map((row): ProductionIncident | null => {
      const id = asString(row.id);
      const environment = asString(row.environment) as DeploymentEnvironment | null;
      const severity = asString(row.severity) as ProductionIncidentSeverity | null;
      const status = asString(row.status) as ProductionIncidentStatus | null;
      const title = asString(row.title);
      const description = asString(row.description);
      const createdAt = asString(row.created_at);
      const updatedAt = asString(row.updated_at);

      if (
        !id ||
        !environment ||
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
        incidentNumber: asNumber(row.incident_number),
        deploymentId: asString(row.deployment_id),
        deploymentVersionLabel: asString(row.deployment_version_label),
        environment,
        severity,
        status,
        title,
        description,
        resolutionNote: asString(row.resolution_note),
        createdAt,
        updatedAt,
        createdByName: asString(row.created_by_name),
      };
    })
    .filter((item): item is ProductionIncident => Boolean(item));
}
