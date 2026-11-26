'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useEffect, useRef } from 'react';

import type { InlineAllocationMutationState } from './inline-allocation-state';

/** Refreshes the active route data in-place after an inline mutation while
 * keeping the user's current scroll position stable instead of jumping to y=0. */
export function useScrollPreservingRefresh(
  state: InlineAllocationMutationState,
) {
  const router = useRouter();
  const lastSequenceRef = useRef(0);

  useEffect(() => {
    if (
      state.sequence === 0 ||
      state.sequence === lastSequenceRef.current ||
      state.status !== 'success'
    ) {
      return;
    }

    lastSequenceRef.current = state.sequence;
    const savedScrollY = window.scrollY;

    startTransition(() => {
      router.refresh();
    });

    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - savedScrollY) > 4) {
        window.scrollTo({ top: savedScrollY, behavior: 'instant' });
      }
    });
  }, [router, state.sequence, state.status]);
}
