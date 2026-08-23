'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @deprecated The Excel upload workflow has been replaced by the online
 * Word-document / topic builder at /teaching-documents/curriculum/editor.
 * This component exists only to satisfy any lingering imports — it immediately
 * redirects the user to the new editor page.
 */
export function CurriculumContentUploadForm() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/teaching-documents/curriculum/editor');
  }, [router]);

  return (
    <div className="flex items-center justify-center p-12 text-xs text-text-muted">
      Redirecting to Syllabus Editor…
    </div>
  );
}
