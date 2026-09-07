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
  searchParams: Promise<{ error?: string; saved?: string; stage_updated?: string }>;
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
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition"
          >
            <ArrowLeft className="size-4" />
            Back to Student List
          </Link>
        }
      />

      {query.saved === '1' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50/90 px-4 py-3 text-emerald-900 shadow-2xs dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-xs font-bold">Unit registration saved &amp; verified successfully!</p>
              <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                The student&apos;s unit registrations are active and verified. You can review or adjust selections below, or return to the student list when finished.
              </p>
            </div>
          </div>
          <Link
            href="/students/unit-registration"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100/50 transition active:scale-95"
          >
            <ArrowLeft className="size-3.5" />
            Back to Student List
          </Link>
        </div>
      ) : null}

      {query.stage_updated === '1' ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/90 p-3 text-blue-900 shadow-2xs dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          <CheckCircle2 className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-xs font-semibold">Academic stage updated. Expected stage units refreshed below.</p>
        </div>
      ) : null}

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
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{expected} expected</Badge>
            <Badge variant={context.existingStatus === 'verified' ? 'success' : 'neutral'}>
              {context.existingStatus === 'verified' ? 'Verified' : 'Not verified'}
            </Badge>
            {context.existingStatus !== 'not_submitted' || context.units.some((u) => u.isSelected) ? (
              <UndoUnitRegistrationButton
                studentId={context.student.id}
                academicPeriodId={context.period.id}
                studentName={context.student.fullName}
                label="Unregister student"
                variant="danger"
                size="sm"
              />
            ) : null}
          </div>
        </div>

{context.student.currentStageId ? (() => {
          const expectedUnits = context.units.filter((u) => u.isExpected);
          const otherOfferedUnits = context.units.filter((u) => !u.isExpected && u.category === 'offered');
          const curriculumUnits = context.units.filter((u) => !u.isExpected && u.category !== 'offered');

          return (
            <form action={registerStudentUnitsByDepartment} className="mt-4 space-y-5">
              <input type="hidden" name="studentId" value={context.student.id} />
              <input type="hidden" name="academicPeriodId" value={context.period.id} />

              {/* 1. Expected Stage Units */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                    Expected Units ({context.student.currentStageName ?? 'Current Stage'})
                  </span>
                  <span className="text-[11px] font-medium text-text-muted">
                    {expectedUnits.length} expected
                  </span>
                </div>
                {expectedUnits.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {expectedUnits.map((unit) => (
                      <label
                        key={unit.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-white px-3 py-3 transition-colors hover:border-primary/50 hover:bg-surface-subtle"
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
                            <span className="font-mono font-medium">{unit.code}</span>
                            <span className="rounded bg-success-subtle px-1.5 py-0.5 font-semibold text-success">
                              Expected
                            </span>
                            {unit.stageName ? <span className="text-text-muted">· {unit.stageName}</span> : null}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs text-text-muted">
                    No units directly bound to this stage yet. You can select from other offered or curriculum units below.
                  </p>
                )}
              </div>

              {/* 2. Other Offered Units in Active Period */}
              {otherOfferedUnits.length > 0 ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                      Other Units Offered This Term ({otherOfferedUnits.length})
                    </span>
                    <span className="text-[11px] text-text-muted">Offered for other cohorts / electives</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {otherOfferedUnits.map((unit) => (
                      <label
                        key={unit.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-white px-3 py-3 transition-colors hover:border-primary/50 hover:bg-surface-subtle"
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
                            <span className="font-mono font-medium">{unit.code}</span>
                            <span className="rounded bg-primary-subtle px-1.5 py-0.5 font-semibold text-primary">
                              Offered This Term
                            </span>
                            {unit.stageName ? <span className="text-text-muted">· {unit.stageName}</span> : null}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 3. Expandable Programme Curriculum Units (Retakes & Carry-overs) */}
              {curriculumUnits.length > 0 ? (
                <details
                  className="group rounded-xl border border-border bg-surface-subtle/40 p-3.5 transition-colors open:bg-white"
                  open={curriculumUnits.some((u) => u.isSelected) ? true : undefined}
                >
                  <summary className="flex cursor-pointer select-none items-center justify-between text-xs font-bold text-text-primary">
                    <div className="flex items-center gap-2">
                      <span>Additional Programme Units & Retakes ({curriculumUnits.length})</span>
                      {curriculumUnits.some((u) => u.isSelected) ? (
                        <span className="rounded bg-accent-subtle px-1.5 py-0.5 text-[10px] font-bold text-accent">
                          {curriculumUnits.filter((u) => u.isSelected).length} selected
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[11px] font-normal text-text-muted group-open:hidden">
                      Click to expand
                    </span>
                  </summary>
                  <p className="mb-3 mt-1.5 text-[11px] text-text-muted">
                    Select any unit from earlier stages for retakes/carry-overs or other curriculum requirements. Offerings are auto-provisioned.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {curriculumUnits.map((unit) => (
                      <label
                        key={unit.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-white px-3 py-2.5 transition-colors hover:border-primary/50 hover:bg-surface-subtle"
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
                            <span className="font-mono font-medium">{unit.code}</span>
                            {unit.stageName ? (
                              <span className="rounded bg-neutral-subtle px-1.5 py-0.5 font-medium text-text-secondary">
                                {unit.stageName}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </details>
              ) : null}

              <div>
                <label htmlFor="registrationNote" className="text-xs font-semibold text-text-secondary">
                  Note <span className="font-normal text-text-muted">(optional; defaults to department authorization)</span>
                </label>
                <textarea
                  id="registrationNote"
                  name="registrationNote"
                  defaultValue={context.existingNote ?? ''}
                  rows={2}
                  maxLength={1000}
                  placeholder="Reason for any unit exception or custom selection (optional)"
                  className="mt-1.5 w-full resize-none rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {context.existingStatus !== 'not_submitted' || context.units.some((u) => u.isSelected) ? (
                  <UndoUnitRegistrationButton
                    studentId={context.student.id}
                    academicPeriodId={context.period.id}
                    studentName={context.student.fullName}
                    label="Unregister (Clear all units)"
                    variant="outline"
                    size="md"
                  />
                ) : <div />}
                <div className="flex items-center gap-2">
                  <Link
                    href="/students/unit-registration"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition"
                  >
                    Return to Student List
                  </Link>
                  <Button type="submit">
                    <CheckCircle2 className="size-4" />
                    Save & verify registration
                  </Button>
                </div>
              </div>
            </form>
          );
        })() : (
          <div className="mt-4 rounded-lg bg-surface-subtle px-3 py-3 text-xs text-text-muted">
            Select the student&apos;s academic stage to load the expected units.
          </div>
        )}
      </Card>
    </div>
  );
}
