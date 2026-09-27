'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @deprecated The legacy form redirects users to the individual document upload
 * page at /teaching-documents/curriculum/individual-upload.
 */
export function CurriculumContentUploadForm() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/teaching-documents/curriculum/individual-upload');
  }, [router]);

  return (
    <div className="flex items-center justify-center p-12 text-xs text-text-muted">
      Redirecting to Curriculum Upload…
    </div>
  );
}
