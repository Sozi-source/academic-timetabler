'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function ScrollPreservationInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentUrl = window.location.pathname + window.location.search;
    const savedUrlKey = 'scroll-preservation:url';
    const savedPosKey = 'scroll-preservation:pos';

    // 1. Restore scroll position ONLY if the URL matches the saved one
    const savedUrl = sessionStorage.getItem(savedUrlKey);
    const savedPos = sessionStorage.getItem(savedPosKey);

    if (savedUrl === currentUrl && savedPos) {
      const scrollY = parseInt(savedPos, 10);
      if (!isNaN(scrollY) && scrollY > 0) {
        // Wait two animation frames to ensure layout paint is complete
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: scrollY, behavior: 'instant' });
          });
        });
      }
    }

    // 2. Setup scroll listener to save position on scroll
    let ticked = false;
    const handleScroll = () => {
      if (!ticked) {
        requestAnimationFrame(() => {
          sessionStorage.setItem(savedUrlKey, window.location.pathname + window.location.search);
          sessionStorage.setItem(savedPosKey, window.scrollY.toString());
          ticked = false;
        });
        ticked = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname, searchParams]);

  return null;
}

export function ScrollPreservation() {
  return (
    <Suspense fallback={null}>
      <ScrollPreservationInner />
    </Suspense>
  );
}
