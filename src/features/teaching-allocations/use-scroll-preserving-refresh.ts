'use client';

import { useEffect, useRef } from 'react';

import type { InlineAllocationMutationState } from './inline-allocation-state';

/** Preserves the user's scroll position across Next.js Server Action RSC
 * revalidation commits without triggering an extra client router.refresh(). */
export function useScrollPreservingRefresh(
  state: InlineAllocationMutationState,
) {
  const savedScrollYRef = useRef<number | null>(null);
  const lastSequenceRef = useRef(0);

  function captureScrollPosition() {
    if (typeof window !== 'undefined') {
      savedScrollYRef.current = window.scrollY;
    }
  }

  useEffect(() => {
    if (
      state.sequence === 0 ||
      state.sequence === lastSequenceRef.current ||
      state.status !== 'success'
    ) {
      return;
    }

    lastSequenceRef.current = state.sequence;
    const savedScrollY = savedScrollYRef.current;
    if (savedScrollY === null || typeof window === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - savedScrollY) > 4) {
        window.scrollTo({ top: savedScrollY, behavior: 'instant' });
      }
    });
  }, [state.sequence, state.status]);

  return { captureScrollPosition };
}
