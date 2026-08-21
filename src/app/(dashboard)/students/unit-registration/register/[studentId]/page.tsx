import Link from 'next/link';
import { ArrowLeft, BookOpenCheck, CheckCircle2 } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { registerStudentUnitsByDepartment, setStudentProgrammeStage } from '@/features/student-unit-registration/actions';
import { getDepartmentRegistrationEditor } from '@/features/student-unit-registration/queries';
import { UndoUnitRegistrationButton } from '@/features/student-unit-registration/undo-registration-button';

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function DepartmentStudentUnitRegistrationPage({
  params,
  searchParams,
}: PageProps) {
  await requireHodAccess();
  const { studentId } = await params;
  const query = await searchParams;
  const context = await getDepartmentRegistrationEditor(studentId);

  if (!context) notFound();

  const expected = context.units.filter((unit) => unit.isExpected).length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Unit registration"
        title={context.student.fullName}
        description={`${context.student.admissionNumber} · ${context.student.programmeCode} · ${context.student.cohortName}`}
        icon={BookOpenCheck}
        context={<Badge variant="institutional">{context.period.name}</Badge>}
        actions={
          <Link
            href="/students/unit-registration"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        }
      />

      {query.error ? (
        <p className="rounded-lg bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">
          {query.error === 'units' ? 'Select at least one unit.' : decodeURIComponent(query.error)}
        </p>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Academic stage</h2>
            <p className="mt-1 text-xs text-text-muted">
              The stage determines the student&apos;s expected units.
            </p>
          </div>

          <form action={setStudentProgrammeStage} className="flex items-end gap-2">
            <input type="hidden" name="studentId" value={context.student.id} />
            <label className="text-xs font-semibold text-text-secondary">
              Stage
              <select
                name="stageId"
                defaultValue={context.student.currentStageId ?? ''}
                className="mt-1 block h-9 min-w-44 rounded-lg border border-border bg-white px-2.5 text-xs"
                required
              >
                <option value="" disabled>Select stage</option>
                {context.stageOptions.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              Set stage
            </Button>
          </form>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Current units</h2>
            <p className="mt-1 text-xs text-text-muted">
              {context.student.currentStageName
                ? `${context.student.currentStageName} units are selected automatically.`
                : 'Select the student stage first.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{expected} expected</Badge>
            <Badge variant={context.existingStatus === 'verified' ? 'success' : 'neutral'}>
              {context.existingStatus === 'verified' ? 'Verified' : 'Not verified'}
            </Badge>
                    {context.existingStatus !== 'not_submitted' ? (
            <UndoUnitRegistrationButton
              studentId={context.student.id}
              academicPeriodId={context.period.id}
            />
          ) : null}
</div>
        </div>

{context.student.currentStageId ? (
        <form action={registerStudentUnitsByDepartment} className="mt-4 space-y-4">
          <input type="hidden" name="studentId" value={context.student.id} />
          <input type="hidden" name="academicPeriodId" value={context.period.id} />

          <div className="grid gap-2 md:grid-cols-2">
            {context.units.map((unit) => (
              <label
                key={unit.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 hover:bg-surface-subtle"
              >
                <input
                  type="checkbox"
                  name="unitIds"
                  value={unit.id}
                  defaultChecked={unit.isSelected}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-text-primary">{unit.name}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-text-muted">
                    {unit.code}
                    {unit.isExpected ? <span className="font-semibold text-success">Expected</span> : <span>Other offered unit</span>}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div>
            <label htmlFor="registrationNote" className="text-xs font-semibold text-text-secondary">
              Note <span className="font-normal text-text-muted">(required only when changing the expected units)</span>
            </label>
            <textarea
              id="registrationNote"
              name="registrationNote"
              defaultValue={context.existingNote ?? ''}
              rows={2}
              maxLength={1000}
              placeholder="Reason for any unit exception"
              className="mt-1.5 w-full resize-none rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit">
              <CheckCircle2 className="size-4" />
              Save & verify registration
            </Button>
          </div>
        </form>
        ) : (
          <div className="mt-4 rounded-lg bg-surface-subtle px-3 py-3 text-xs text-text-muted">
            Select the student&apos;s academic stage to load the expected units.
          </div>
        )}
      </Card>
    </div>
  );
}
