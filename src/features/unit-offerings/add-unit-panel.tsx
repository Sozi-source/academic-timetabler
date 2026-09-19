'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CohortUnitEditor } from './cohort-unit-editor';

type AddUnitPanelProps = {
  academicPeriodId: string;
  cohorts: Parameters<typeof CohortUnitEditor>[0]['cohorts'];
  units: Parameters<typeof CohortUnitEditor>[0]['units'];
  existingPairs: string[];
};

export function AddUnitPanel({
  academicPeriodId,
  cohorts,
  units,
  existingPairs,
}: AddUnitPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border bg-background">
      {!open ? (
        <div className="flex items-center justify-between gap-3 p-3">
          <div>
            <h2 className="text-sm font-semibold">Units on offer</h2>
            <p className="text-xs text-text-muted">
              Add a unit to a cohort
            </p>
          </div>

          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add unit
          </Button>
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Add unit to cohort</h2>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close add unit"
            >
              <X className="size-4" />
            </Button>
          </div>

          <CohortUnitEditor
            academicPeriodId={academicPeriodId}
            cohorts={cohorts}
            units={units}
            existingPairs={existingPairs}
          />
        </div>
      )}
    </section>
  );
}