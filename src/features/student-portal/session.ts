import { createHash, randomBytes } from 'node:crypto';

import { cookies } from 'next/headers';

import { createAdminClient } from '@/lib/supabase/admin';

const COOKIE_NAME = 'ams_student_session';
const SESSION_HOURS = 12;

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createStudentPortalSession(studentId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const admin = createAdminClient();

  const { error } = await admin.from('student_portal_sessions').insert({
    student_id: studentId,
    token_hash: tokenHash(token),
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error(`Unable to create student session: ${error.message}`);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function getStudentPortalSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('student_portal_sessions')
    .select('id, student_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash(token))
    .maybeSingle();

  if (error || !data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) {
    store.delete(COOKIE_NAME);
    return null;
  }

  await admin
    .from('student_portal_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id);

  return { id: data.id as string, studentId: data.student_id as string };
}

export async function revokeStudentPortalSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    const admin = createAdminClient();
    await admin
      .from('student_portal_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash(token));
  }
  store.delete(COOKIE_NAME);
}
