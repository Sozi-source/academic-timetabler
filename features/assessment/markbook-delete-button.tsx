'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';

export function MarkbookDeleteButton({
  assessmentId,
  unitLabel,
}: {
  assessmentId: string;
  unitLabel?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/assessment/markbooks/${assessmentId}`,
        {
          method: 'DELETE',
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(payload?.message ?? 'Markbook could not be deleted.');
        return;
      }

      toast.success('Markbook deleted successfully.');
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error('An error occurred while deleting the markbook.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-danger-border bg-surface px-2.5 text-[11px] font-semibold text-danger transition hover:bg-danger-surface hover:border-danger/40 cursor-pointer"
          aria-label="Delete generated markbook"
        >
          <Trash2 className="size-3" aria-hidden="true" />
          Delete
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Delete Markbook</DialogTitle>
        </DialogHeader>
        <DialogBody className="text-sm text-text-secondary leading-relaxed space-y-2">
          <p>
            Are you sure you want to delete the generated markbook for{' '}
            <span className="font-semibold text-text-primary">{unitLabel || 'this unit'}</span>?
          </p>
          <p className="text-xs text-text-muted">
            This action is allowed only when no marks or protected academic history exist. This action cannot be undone.
          </p>
        </DialogBody>
        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="text-xs font-semibold h-9 rounded-xl"
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={remove}
            disabled={busy}
            className="bg-danger text-white hover:bg-danger-hover text-xs font-semibold h-9 rounded-xl transition-colors disabled:cursor-wait"
          >
            {busy ? 'Deleting...' : 'Delete markbook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
