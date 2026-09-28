import type { ReactNode } from 'react';

import { TrainerShell } from '@/components/layout/trainer-shell';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const profile = await requireTrainerAccess();
  const admin = createAdminClient();

  const { data: trainer } = await admin
    .from('trainers')
    .select('full_name')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle<{ full_name: string }>();

  return (
    <TrainerShell trainerName={trainer?.full_name ?? profile.fullName}>
      {children}
    </TrainerShell>
  );
}
