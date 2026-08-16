import type { Metadata } from 'next';
import {
  CalendarDays,
  Plus,
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
import { PageHeader } from '@/components/ui/page-header';
import {
  getAcademicYears,
} from '@/features/academic-years/queries';
import {
  AcademicPeriodTable,
} from '@/features/academic-periods/academic-period-table';
import {
  CreateAcademicPeriodForm,
} from '@/features/academic-periods/create-academic-period-form';
import {
  getAcademicPeriods,
} from '@/features/academic-periods/queries';

export const metadata: Metadata = {
  title: 'Academic Periods',
  description:
    'Create and manage institutional Academic Periods and teaching windows.',
};

export default async function AcademicPeriodsPage() {
  const [
    academicPeriods,
    academicYears,
  ] = await Promise.all([
    getAcademicPeriods(),
    getAcademicYears(),
  ]);

  const availableAcademicYears =
    academicYears.filter(
      (academicYear) =>
        academicYear.status !== 'archived',
    );

  const activePeriod =
    academicPeriods.find(
      (period) => period.status === 'active',
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic calendar"
        title="Academic Periods"
        description="Define ordered teaching periods and their teaching windows within each Academic Year."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {academicPeriods.length === 1
                ? '1 Academic Period'
                : `${academicPeriods.length} Academic Periods`}
            </Badge>

            {activePeriod ? (
              <Badge variant="success" dot>
                Active: {activePeriod.name}
              </Badge>
            ) : (
              <Badge variant="warning" dot>
                No active Academic Period
              </Badge>
            )}
          </div>
        }
        actions={
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
                Add Academic Period
              </Button>
            </DrawerTrigger>

            <DrawerContent>
              <DrawerHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <CalendarDays
                      className="size-5"
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <DrawerTitle>
                      Create Academic Period
                    </DrawerTitle>
                  </div>
                </div>
              </DrawerHeader>

              <DrawerBody className="pb-10">
                {availableAcademicYears.length >
                0 ? (
                  <CreateAcademicPeriodForm
                    academicYears={
                      availableAcademicYears
                    }
                  />
                ) : (
                  <div className="rounded-xl border border-warning-border bg-warning-surface px-4 py-4 text-sm text-warning">
                    Create an Academic Year before
                    adding Academic Periods.
                  </div>
                )}
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        }
      />

      <AcademicPeriodTable
        academicPeriods={academicPeriods}
      />
    </div>
  );
}