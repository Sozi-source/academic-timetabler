import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';

const pinSchema = z.object({
  pin: z.string().regex(/^\d{16}$/),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = pinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Enter the 16-digit PIN provided by your department.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const pinHash = createHash('sha256').update(parsed.data.pin).digest('hex');
  const { data: pinRecord, error: pinError } = await admin
    .from('external_trainer_access_pins')
    .select('trainer_id')
    .eq('pin_hash', pinHash)
    .maybeSingle();

  if (pinError || !pinRecord) {
    return NextResponse.json({ message: 'That PIN is invalid or has been replaced.' }, { status: 401 });
  }

  const { data: trainer, error: trainerError } = await admin
    .from('trainers')
    .select('id,profile_id,is_active')
    .eq('id', pinRecord.trainer_id)
    .eq('is_active', true)
    .maybeSingle();

  if (trainerError || !trainer?.profile_id) {
    return NextResponse.json({ message: 'Trainer access is not active. Contact the department.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,email,role,is_active')
    .eq('id', trainer.profile_id)
    .eq('role', 'trainer')
    .eq('is_active', true)
    .maybeSingle();

  if (profileError || !profile?.email) {
    return NextResponse.json({ message: 'Trainer access is not active. Contact the department.' }, { status: 401 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
    options: { redirectTo: new URL('/auth/callback?next=/external-trainer', request.url).toString() },
  });

  if (linkError || !linkData.properties.hashed_token) {
    return NextResponse.json({ message: 'Unable to sign in right now. Please try again.' }, { status: 503 });
  }

  return NextResponse.json({ email: profile.email, tokenHash: linkData.properties.hashed_token });
}
