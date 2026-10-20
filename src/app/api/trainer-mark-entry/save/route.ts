import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getTrainerMarkInvite } from '@/features/assessment/trainer-mark-entry';
import { createAdminClient } from '@/lib/supabase/admin';

const inviteCookieName = 'trainer_mark_invite';
const markValue = z.number().finite().nullable();
const entriesSchema = z.array(z.object({
  student_id: z.string().uuid(),
  assignment: markValue,
  presentation: markValue,
  rat: markValue,
  cat: markValue,
  exam: markValue,
})).min(1).max(2000);
const saveSchema = z.object({ entries: entriesSchema, submit: z.boolean().default(false) });

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(inviteCookieName)?.value;
  if (!token) return NextResponse.json({ message: 'Open your invitation link to access this markbook.' }, { status: 401 });

  const rawBody = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ message: 'Check the marks and try again.' }, { status: 400 });

  try {
    const invite = await getTrainerMarkInvite(token);
    if (!invite) return NextResponse.json({ message: 'This trainer link has expired or was revoked.' }, { status: 410 });

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('save_assessment_marks_with_trainer_invite', {
      target_token_hash: invite.token_hash,
      target_entries: parsed.data.entries,
      submit_marks: parsed.data.submit,
    });
    if (error) {
      const status = error.code === '42501' ? 403 : error.code === '23514' ? 422 : 409;
      return NextResponse.json({ message: error.message }, { status });
    }
    return NextResponse.json({ success: true, result: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unable to save trainer marks.' }, { status: 500 });
  }
}
