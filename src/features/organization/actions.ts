'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import type { AppRole } from '@/features/auth/types';
import { createClient } from '@/lib/supabase/server';

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(30)
  .regex(/^[A-Z0-9_-]+$/);
const nameSchema = z.string().trim().min(2).max(160);
const idSchema = z.uuid();

function requireSystemAdministrator(
  role: AppRole,
) {
  if (role !== 'system_admin') {
    throw new Error(
      'Only a system administrator can change the institution structure.',
    );
  }
}

function refreshOrganization() {
  revalidatePath('/', 'layout');
  revalidatePath('/timetable/organization');
  revalidatePath('/timetable/programmes');
  revalidatePath('/timetable/trainers');
}

export async function createAcademicWorkspaceAction(
  formData: FormData,
) {
  const profile = await requireHodAccess();
  requireSystemAdministrator(profile.role);

  const parsed = z
    .object({ code: codeSchema, name: nameSchema })
    .safeParse({
      code: formData.get('code'),
      name: formData.get('name'),
    });

  if (!parsed.success) {
    throw new Error(
      'Enter a valid school / department code and name.',
    );
  }

  const db = await createClient();
  const { error } = await db.rpc(
    'create_academic_workspace',
    {
      workspace_code: parsed.data.code,
      workspace_name: parsed.data.name,
    },
  );

  if (error) {
    throw new Error(
      error.code === '23505'
        ? 'That school or department code/name is already in use.'
        : error.message,
    );
  }

  refreshOrganization();
}

export async function assignDepartmentMemberAction(
  formData: FormData,
) {
  const profile = await requireHodAccess();
  requireSystemAdministrator(profile.role);

  const parsed = z
    .object({
      profileId: idSchema,
      departmentId: idSchema,
      membershipRole: z.enum([
        'school_admin',
        'hod',
        'timetable_officer',
        'staff',
      ]),
      isPrimary: z.boolean(),
    })
    .safeParse({
      profileId: formData.get('profileId'),
      departmentId: formData.get('departmentId'),
      membershipRole: formData.get('membershipRole'),
      isPrimary: formData.get('isPrimary') === 'on',
    });

  if (!parsed.success) {
    throw new Error('Select a user, workspace and access level.');
  }

  const db = await createClient();
  const { error } = await db.rpc('assign_workspace_access', {
    p_profile_id: parsed.data.profileId,
    p_department_id: parsed.data.departmentId,
    p_membership_role: parsed.data.membershipRole,
    p_is_primary: parsed.data.isPrimary,
  });

  if (error) {
    throw new Error(`Unable to assign workspace access: ${error.message}`);
  }

  refreshOrganization();
}

export async function setActiveDepartmentAction(
  formData: FormData,
) {
  await requireHodAccess();
  const departmentId = idSchema.safeParse(
    formData.get('departmentId'),
  );

  if (!departmentId.success) {
    throw new Error('Select a valid workspace.');
  }

  const db = await createClient();
  const { error } = await db.rpc('set_active_workspace', {
    p_department_id: departmentId.data,
  });

  if (error) {
    throw new Error(`Unable to switch workspace: ${error.message}`);
  }

  refreshOrganization();
}
