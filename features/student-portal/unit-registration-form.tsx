import {
  Badge,
} from '@/components/ui/badge';

import type {
  StudentPortalUnit,
} from './types';

export function StudentRegistrationUnitList({
  units,
}: {
  units:
    StudentPortalUnit[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="hidden grid-cols-[4rem_1fr_8rem] gap-3 border-b border-border bg-surface-subtle px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-text-muted sm:grid">
        <span>Code</span>
        <span>Unit</span>
        <span>Status</span>
      </div>

      <div className="divide-y divide-border">
        {units.map(
          (
            unit,
          ) => (
            <div
              key={
                unit.registrationId
              }
              className="grid gap-1.5 px-4 py-3 sm:grid-cols-[4rem_1fr_8rem] sm:items-center sm:gap-3"
            >
              <p className="text-[10px] font-bold text-text-muted">
                {
                  unit.unitCode
                }
              </p>

              <p className="text-xs font-semibold text-text-primary">
                {
                  unit.unitName
                }
              </p>

              <div>
                <Badge
                  variant={
                    unit.registrationStatus ===
                    'registered'
                      ? 'success'
                      : 'neutral'
                  }
                >
                  {
                    unit.registrationStatus ===
                    'registered'
                      ? 'Registered'
                      : unit.registrationStatus
                  }
                </Badge>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
