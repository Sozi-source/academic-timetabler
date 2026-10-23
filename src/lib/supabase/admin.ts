import { createClient } from '@supabase/supabase-js';

import { getServerEnvironment } from '@/lib/validation/environment';

export function createAdminClient(options?: { timeoutMs?: number }) {
  const environment = getServerEnvironment();
  const timeoutMs = options?.timeoutMs;

  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      ...(timeoutMs
        ? {
            global: {
              fetch: (input: RequestInfo | URL, init?: RequestInit) =>
                fetch(input, {
                  ...init,
                  signal: AbortSignal.timeout(timeoutMs),
                }),
            },
          }
        : {}),
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
