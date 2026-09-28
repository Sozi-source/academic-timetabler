import { createBrowserClient } from '@supabase/ssr';

import { getPublicEnvironment } from '@/lib/validation/environment';

export function createClient() {
  const environment = getPublicEnvironment();

  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
