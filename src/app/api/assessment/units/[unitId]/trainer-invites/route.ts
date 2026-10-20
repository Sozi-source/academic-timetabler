import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { hashTrainerMarkScopeToken, hashTrainerMarkToken } from '@/features/assessment/trainer-mark-entry';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ unitId: string }>;
}

const inviteSchema = z.object({
  periodId: z.string().uuid(),
  trainerName: z.string().trim().min(2).max(120),
  trainerEmail: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  expiryDays: z.number().int().min(1).max(14).default(7),
});

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function getUnitScope(admin: ReturnType<typeof createAdminClient>, unitId: string, departmentId: string) {
  const { data: baseUnit, error: unitError } = await admin.from('units')
    .select('id,code,name,programme:programmes!inner(department_id)')
    .eq('id', unitId)
    .eq('programme.department_id', departmentId)
    .maybeSingle();
  if (unitError) throw new Error('Could not validate this unit.');
  if (!baseUnit) return null;

  const { data: memberships, error: membershipError } = await admin.from('unit_equivalence_members')
    .select('equivalence_group_id,group:unit_equivalence_groups!inner(status,department_id)')
    .eq('unit_id', unitId)
    .eq('status', 'approved');
  if (membershipError) throw new Error('Could not load approved unit equivalences.');
  const activeGroup = (memberships ?? []).find((membership) => {
    const group = one(membership.group as { status: string; department_id: string | null } | { status: string; department_id: string | null }[] | null);
    return group?.status === 'active' && (!group.department_id || group.department_id === departmentId);
  });
  let unitIds = [unitId];
  if (activeGroup) {
    const { data: members, error: membersError } = await admin.from('unit_equivalence_members')
      .select('unit_id,unit:units!inner(programme:programmes!inner(department_id))')
      .eq('equivalence_group_id', activeGroup.equivalence_group_id)
      .eq('status', 'approved')
      .eq('unit.programme.department_id', departmentId);
    if (membersError) throw new Error('Could not load equivalent units.');
    unitIds = [...new Set((members ?? []).map((member) => member.unit_id))];
  }
  return { unitIds, scopeUnitId: [...unitIds].sort()[0] ?? unitId, unitCode: baseUnit.code, unitName: baseUnit.name };
}

async function loadReadyScopes(admin: ReturnType<typeof createAdminClient>, unitIds: string[], departmentId: string, periodId: string) {
  const { data: events, error: eventsError } = await admin.from('assessment_events')
    .select('id,unit_id,assessment_type,status,exam_marks_finalized_at')
    .eq('department_id', departmentId)
    .eq('academic_period_id', periodId)
    .in('unit_id', unitIds)
    .eq('title', 'Unit Markbook');
  if (eventsError) throw new Error('Could not load unit markbooks.');
  const examEvents = (events ?? []).filter((event) => event.assessment_type === 'exam' && event.status !== 'closed' && !event.exam_marks_finalized_at);
  const eventIds = examEvents.map((event) => event.id);
  if (!eventIds.length) return [];

  const [{ data: workspaces, error: workspaceError }, { data: rosters, error: rosterError }, { data: results, error: resultsError }, { data: rules, error: rulesError }] = await Promise.all([
    admin.from('assessment_event_workspace').select('id,workflow_status,population_locked_at,academic_period_id,unit_id').in('id', eventIds),
    admin.from('assessment_roster').select('assessment_id,cohort_id').in('assessment_id', eventIds),
    admin.from('assessment_results').select('assessment_event_id').in('assessment_event_id', eventIds),
    admin.from('assessment_rules').select('unit_id,maximum_mark').eq('academic_period_id', periodId).eq('assessment_type', 'exam').in('unit_id', unitIds),
  ]);
  if (workspaceError || rosterError || resultsError || rulesError) throw new Error('Could not validate unit markbook readiness.');
  const workspaceById = new Map((workspaces ?? []).map((workspace) => [workspace.id, workspace]));
  const resultIds = new Set((results ?? []).map((result) => result.assessment_event_id));
  const validRules = new Set((rules ?? []).filter((rule) => Number(rule.maximum_mark) === 100).map((rule) => rule.unit_id));
  const rostersByAssessment = new Map<string, Array<{ cohort_id: string | null }>>();
  for (const row of rosters ?? []) rostersByAssessment.set(row.assessment_id, [...(rostersByAssessment.get(row.assessment_id) ?? []), row]);

  return examEvents.flatMap((event) => {
    const workspace = workspaceById.get(event.id);
    const rosterRows = rostersByAssessment.get(event.id) ?? [];
    if (!workspace?.population_locked_at || !rosterRows.length || resultIds.has(event.id) || !validRules.has(event.unit_id) || ['submitted', 'finalised', 'archived'].includes(workspace.workflow_status)) return [];
    const cohortIds = [...new Set(rosterRows.map((row) => row.cohort_id))];
    return cohortIds.map((cohortId) => ({ assessmentId: event.id, cohortId }));
  });
}

export async function GET(_request: Request, { params }: RouteContext) {
  const profile = await requireHodAccess();
  const { unitId } = await params;
  const periodId = new URL(_request.url).searchParams.get('periodId');
  if (!profile.activeDepartmentId || !periodId) return NextResponse.json({ message: 'Select an active department and period.' }, { status: 409 });
  const admin = createAdminClient();
  try {
    const scope = await getUnitScope(admin, unitId, profile.activeDepartmentId);
    if (!scope) return NextResponse.json({ message: 'This unit is unavailable.' }, { status: 404 });
    const { data: invites, error } = await admin.from('assessment_trainer_mark_invites')
        .select('id,trainer_name,trainer_email,created_at,expires_at,last_accessed_at,submitted_at,revoked_at')
        .eq('department_id', profile.activeDepartmentId)
        .eq('scope_unit_id', scope.scopeUnitId)
        .eq('scope_period_id', periodId)
        .is('parent_invite_id', null)
        .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ message: 'Could not load unit trainer links.' }, { status: 500 });
    const inviteIds = (invites ?? []).map((invite) => invite.id);
    const { data: childScopes, error: childError } = inviteIds.length
      ? await admin.from('assessment_trainer_mark_invites').select('parent_invite_id,cohort_id,submitted_at,revoked_at,expires_at').in('parent_invite_id', inviteIds)
      : { data: [], error: null };
    if (childError) return NextResponse.json({ message: 'Could not load cohort link statuses.' }, { status: 500 });
    const scopesByInvite = new Map<string, typeof childScopes>();
    for (const child of childScopes ?? []) scopesByInvite.set(child.parent_invite_id!, [...(scopesByInvite.get(child.parent_invite_id!) ?? []), child]);
    return NextResponse.json({
      invites: (invites ?? []).map((invite) => {
        const children = scopesByInvite.get(invite.id) ?? [];
        const byCohort = new Map<string, typeof children>();
        for (const child of children) {
          const cohortKey = child.cohort_id ?? 'all';
          byCohort.set(cohortKey, [...(byCohort.get(cohortKey) ?? []), child]);
        }
        const submittedCohortCount = [...byCohort.values()].filter((cohortScopes) => cohortScopes.length > 0 && cohortScopes.every((child) => child.submitted_at)).length;
        const status = invite.revoked_at ? 'revoked' : byCohort.size > 0 && submittedCohortCount === byCohort.size ? 'submitted' : Date.parse(invite.expires_at) <= Date.now() ? 'expired' : 'active';
        return { ...invite, status, cohortCount: byCohort.size, submittedCohortCount };
      }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not load unit trainer links.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const profile = await requireHodAccess();
  const { unitId } = await params;
  if (!profile.activeDepartmentId) return NextResponse.json({ message: 'Select an active department.' }, { status: 409 });
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: 'Enter a trainer name, a valid email if available, and an expiry from 1 to 14 days.' }, { status: 400 });

  const admin = createAdminClient();
  try {
    const scope = await getUnitScope(admin, unitId, profile.activeDepartmentId);
    if (!scope) return NextResponse.json({ message: 'This unit is unavailable.' }, { status: 404 });
    const readyScopes = await loadReadyScopes(admin, scope.unitIds, profile.activeDepartmentId, parsed.data.periodId);
    if (!readyScopes.length) return NextResponse.json({ message: 'No open, locked exam rosters with a 100-mark rule are available in this unit.' }, { status: 409 });
    const { data: registrations, error: registrationError } = await admin.from('student_unit_registrations')
      .select('cohort_id')
      .eq('academic_period_id', parsed.data.periodId)
      .eq('registration_status', 'registered')
      .in('unit_id', scope.unitIds);
    if (registrationError) return NextResponse.json({ message: 'Could not verify the registered cohorts for this unit.' }, { status: 500 });
    const expectedCohorts = new Set((registrations ?? []).map((row) => row.cohort_id).filter((cohortId): cohortId is string => Boolean(cohortId)));
    const availableCohorts = new Set(readyScopes.map((item) => item.cohortId).filter((cohortId): cohortId is string => Boolean(cohortId)));
    const missingCohortIds = [...expectedCohorts].filter((cohortId) => !availableCohorts.has(cohortId));
    if (missingCohortIds.length > 0) {
      const { data: missingCohorts } = await admin.from('cohorts')
        .select('code,name')
        .eq('department_id', profile.activeDepartmentId)
        .in('id', missingCohortIds)
        .order('name');
      const cohortNames = (missingCohorts ?? []).map((cohort) => cohort.code || cohort.name);
      const detail = cohortNames.length > 0 ? ` Missing: ${cohortNames.join(', ')}.` : '';
      return NextResponse.json({ message: `Lock and generate an open exam roster for every currently registered cohort before creating one unit-level trainer link.${detail}` }, { status: 409 });
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + parsed.data.expiryDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: root, error: rootError } = await admin.from('assessment_trainer_mark_invites').insert({
      assessment_id: readyScopes[0].assessmentId,
      department_id: profile.activeDepartmentId,
      trainer_name: parsed.data.trainerName,
      trainer_email: parsed.data.trainerEmail || null,
      token_hash: hashTrainerMarkToken(token),
      expires_at: expiresAt,
      created_by: profile.id,
      scope_unit_id: scope.scopeUnitId,
      scope_period_id: parsed.data.periodId,
    }).select('id,expires_at').single();
    if (rootError || !root) return NextResponse.json({ message: 'Could not create the trainer invitation.' }, { status: 500 });

    const childRows = readyScopes.map((item) => ({
      assessment_id: item.assessmentId,
      department_id: profile.activeDepartmentId,
      trainer_name: parsed.data.trainerName,
      trainer_email: parsed.data.trainerEmail || null,
      token_hash: hashTrainerMarkScopeToken(token, item.assessmentId, item.cohortId),
      expires_at: expiresAt,
      created_by: profile.id,
      parent_invite_id: root.id,
      cohort_id: item.cohortId,
    }));
    const { error: scopeError } = await admin.from('assessment_trainer_mark_invites').insert(childRows);
    if (scopeError) {
      await admin.from('assessment_trainer_mark_invites').delete().eq('id', root.id);
      return NextResponse.json({ message: 'Could not create cohort access for this trainer link.' }, { status: 500 });
    }
    const inviteUrl = new URL('/trainer-mark-entry', request.url);
    const unitSlug = `${scope.unitCode}-${scope.unitName}`
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    inviteUrl.searchParams.set('unit', unitSlug);
    inviteUrl.hash = token;
    return NextResponse.json({ invite: { id: root.id, expiresAt: root.expires_at, cohortCount: readyScopes.length }, inviteUrl: inviteUrl.toString() }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not create the unit trainer link.' }, { status: 500 });
  }
}
