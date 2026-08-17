'use client';

import { Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';

interface CrudModalProps {
  title: string;
  description?: string;
  triggerLabel: string;
  children: ReactNode;
  widthClassName?: string;
}

export function CrudModal({
  title,
  description,
  triggerLabel,
  children,
  widthClassName = 'max-w-2xl',
}: CrudModalProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          <Plus className="size-4" aria-hidden="true" />
          {triggerLabel}
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl ${widthClassName}`}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-background px-5 py-4">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-base font-semibold text-foreground"
                >
                  {title}
                </h2>

                {description ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {children}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
