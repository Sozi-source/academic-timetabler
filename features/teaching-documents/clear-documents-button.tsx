'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearAllGeneratedCurriculumDocumentsAction } from '@/features/teaching-documents/curriculum-library-v54/actions';

export function ClearDocumentsButton() {
  const [isPending, setIsPending] = useState(false);

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all generated curriculum documents and staged batches? This will reset the curriculum library.')) {
      return;
    }

    setIsPending(true);
    try {
      await clearAllGeneratedCurriculumDocumentsAction();
      alert('All generated documents have been successfully cleared.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to clear documents');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClear}
      disabled={isPending}
      className="text-danger border-danger-border hover:bg-danger-surface"
      leadingIcon={<Trash2 className="size-3.5" />}
    >
      {isPending ? 'Clearing...' : 'Clear Documents'}
    </Button>
  );
}
