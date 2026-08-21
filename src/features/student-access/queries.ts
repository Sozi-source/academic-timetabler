import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  StudentPortalAccessRow,
} from './types';

interface AccessRegisterRow {
  student_id: string;
  admission_number: string;
  full_name: string;
  programme_code:
    string |
    null;
  cohort_name:
    string |
    null;
  lifecycle_status: string;
  has_credential: boolean;
  is_active: boolean;
  issued_at:
    string |
    null;
  last_login_at:
    string |
    null;
  failed_login_attempts:
    number |
    string;
  locked_until:
    string |
    null;
}

export async function getStudentPortalAccessRegister():
Promise<StudentPortalAccessRow[]> {
  const supabase =
    (
      await createClient()
    ) as unknown as
      SupabaseClient;

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_student_portal_access_register',
    );

  if (error) {
    throw new Error(
      `Unable to load student portal access: ${error.message}`,
    );
  }

  return (
    (
      data ??
      []
    ) as AccessRegisterRow[]
  ).map(
    (row) => ({
      studentId:
        row.student_id,
      admissionNumber:
        row.admission_number,
      fullName:
        row.full_name,
      programmeCode:
        row.programme_code ??
        '—',
      cohortName:
        row.cohort_name ??
        '—',
      lifecycleStatus:
        row.lifecycle_status,
      hasCredential:
        row.has_credential,
      isActive:
        row.is_active,
      issuedAt:
        row.issued_at,
      lastLoginAt:
        row.last_login_at,
      failedLoginAttempts:
        Number(
          row.failed_login_attempts ??
          0,
        ),
      lockedUntil:
        row.locked_until,
    }),
  );
}
