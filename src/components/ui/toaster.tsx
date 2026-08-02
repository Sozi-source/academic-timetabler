'use client';

import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors={false}
      icons={{
        success: (
          <CheckCircle2 className="size-4 text-success" />
        ),
        error: (
          <CircleAlert className="size-4 text-danger" />
        ),
        warning: (
          <TriangleAlert className="size-4 text-warning" />
        ),
        info: (
          <Info className="size-4 text-info" />
        ),
        close: (
          <X className="size-3.5" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            'border border-border bg-surface text-text-primary shadow-md',
          title:
            'text-sm font-semibold text-text-primary',
          description:
            'text-sm text-text-secondary',
          closeButton:
            'border-border bg-surface text-text-muted hover:text-text-primary',
        },
      }}
    />
  );
}