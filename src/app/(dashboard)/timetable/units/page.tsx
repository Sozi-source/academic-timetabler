import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  CalendarCheck2,
  Clock3,
  FlaskConical,
  Plus,
  Upload,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import {
  getProgrammes,
} from '@/features/programmes/queries';
import {
  CreateUnitForm,
} from '@/features/units/create-unit-form';
import {
  getUnits,
} from '@/features/units/queries';
import {
  UnitTable,
} from '@/features/units/unit-table';

export const metadata: Metadata = {
  title: 'Units',
  description:
    'Register and manage curriculum units, contact hours and timetable requirements.',
};

export default async function UnitsPage() {
  const [units, programmes] =
    await Promise.all([
      getUnits(),
      getProgrammes(),
    ]);

  const availableProgrammes =
    programmes.filter(
      (programme) =>
        programme.isActive &&
        programme.isTimetableAvailable,
    );

  const activeUnits = units.filter(
    (unit) => unit.isActive,
  );

  const timetableUnits = units.filter(
    (unit) =>
      unit.isActive &&
      unit.isTimetableAvailable,
  );

  const practicalUnits = units.filter(
    (unit) =>
      unit.isActive &&
      unit.practicalHours > 0,
  );

  const totalContactHours =
    activeUnits.reduce(
      (total, unit) =>
        total +
        unit.theoryHours +
        unit.practicalHours,
      0,
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic structure"
        title="Units"
        description="Manage curriculum units, programme-period placement, contact hours, session requirements and preferred teaching spaces."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {units.length === 1
                ? '1 unit'
                : `${units.length} units`}
            </Badge>

            <Badge variant="success" dot>
              {timetableUnits.length} timetable available
            </Badge>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/timetable/units/import"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <Upload
                className="size-4"
                aria-hidden="true"
              />
              Import units
            </Link>

            {availableProgrammes.length > 0 ? (
              <Drawer>
              <DrawerTrigger asChild>
                <Button
                  leadingIcon={
                    <Plus
                      className="size-4"
                      aria-hidden="true"
                    />
                  }
                >
                  Add unit
                </Button>
              </DrawerTrigger>

              <DrawerContent>
                <DrawerHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <BookOpen
                        className="size-5"
                        aria-hidden="true"
                      />
                    </div>

                    <div>
                      <DrawerTitle>
                        Register unit
                      </DrawerTitle>
                    </div>
                  </div>
                </DrawerHeader>

                <DrawerBody className="pb-10">
                  <CreateUnitForm
                    programmes={
                      availableProgrammes
                    }
                  />
                </DrawerBody>
              </DrawerContent>
              </Drawer>
            ) : null}
          </div>
        }
      />

      {availableProgrammes.length === 0 ? (
        <div className="rounded-2xl border border-warning-border bg-warning-surface px-5 py-4 text-sm text-text-secondary">
          Create or activate a timetable-available
          programme before registering units.
        </div>
      ) : null}

      <section
        aria-label="Unit metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Registered units"
          value={String(units.length)}
          description="All retained curriculum units"
          icon={BookOpen}
          status="Total"
        />

        <MetricCard
          label="Active units"
          value={String(activeUnits.length)}
          description="Currently operational units"
          icon={CalendarCheck2}
          status="Active"
        />

        <MetricCard
          label="Practical units"
          value={String(practicalUnits.length)}
          description="Units with practical contact hours"
          icon={FlaskConical}
          status="Practical"
        />

        <MetricCard
          label="Contact hours"
          value={String(totalContactHours)}
          description="Combined active-unit contact hours"
          icon={Clock3}
          status="Hours"
        />
      </section>

      <UnitTable
        units={units}
        programmeOptions={programmes.map(
          (programme) => ({
            id: programme.id,
            code: programme.code,
            name: programme.name,
            totalAcademicPeriods:
              programme.totalAcademicPeriods,
          }),
        )}
      />
    </div>
  );
}