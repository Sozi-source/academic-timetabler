import {
  AlertTriangle,
  BookOpenCheck,
  ChevronDown,
  Layers3,
  Link2,
  Save,
} from 'lucide-react';

import {
  saveProgrammeStageUnits,
} from '@/features/student-unit-registration/actions';

import type {
  ProgrammeStageSetup,
} from '@/features/student-unit-registration/types';

interface ProgrammeStageManagementProps {
  setups: ProgrammeStageSetup[];
}

function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return count === 1 ? singular : plural;
}

export function ProgrammeStageManagement({
  setups,
}: ProgrammeStageManagementProps) {
  const totalStages = setups.reduce(
    (sum, setup) => sum + setup.stages.length,
    0,
  );

  const totalBindings = setups.reduce(
    (sum, setup) =>
      sum +
      setup.stages.reduce(
        (stageSum, stage) =>
          stageSum + stage.unitIds.length,
        0,
      ),
    0,
  );

  const unboundUnits = setups.reduce(
    (sum, setup) => {
      const bound = new Set(
        setup.stages.flatMap((stage) => stage.unitIds),
      );

      return (
        sum +
        setup.units.filter(
          (unit) => !bound.has(unit.id),
        ).length
      );
    },
    0,
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-primary" />

              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                Curriculum structure
              </p>
            </div>

            <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Programme stages
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
              Review programme stages and confirm the curriculum
              units attached to each stage. Student registration
              uses these bindings to determine expected units.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            Stage codes use the official
            <span className="font-semibold">
              {' '}Y1S1, Y1S2, Y1S3
            </span>{' '}
            format.
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={BookOpenCheck}
          label="Programmes"
          value={setups.length}
        />

        <Metric
          icon={Layers3}
          label="Stages"
          value={totalStages}
        />

        <Metric
          icon={Link2}
          label="Unit bindings"
          value={totalBindings}
        />

        <Metric
          icon={AlertTriangle}
          label="Unbound units"
          value={unboundUnits}
          warning={unboundUnits > 0}
        />
      </section>

      {setups.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <BookOpenCheck className="mx-auto h-7 w-7 text-muted-foreground" />

          <h2 className="mt-3 text-sm font-semibold text-foreground">
            No programme stages available
          </h2>

          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Programme stages will appear here after they have
            been configured.
          </p>
        </section>
      ) : null}

      <div className="space-y-3">
        {setups.map((setup, setupIndex) => {
          const programmeBound = new Set(
            setup.stages.flatMap(
              (stage) => stage.unitIds,
            ),
          );

          const programmeUnbound =
            setup.units.filter(
              (unit) =>
                !programmeBound.has(unit.id),
            );

          return (
            <details
              key={setup.programmeId}
              open={setupIndex === 0}
              className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition hover:bg-muted/50 sm:px-5">
                <div className="flex h-9 min-w-14 items-center justify-center rounded-lg bg-primary px-2.5 text-xs font-bold tracking-wide text-primary-foreground">
                  {setup.programmeCode}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                    {setup.programmeName}
                  </h2>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {setup.stages.length}{' '}
                    {pluralize(
                      setup.stages.length,
                      'stage',
                    )}
                    {' Â· '}
                    {setup.units.length}{' '}
                    {pluralize(
                      setup.units.length,
                      'curriculum unit',
                    )}
                  </p>
                </div>

                <div className="hidden sm:block">
                  {programmeUnbound.length > 0 ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      {programmeUnbound.length} unbound
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                      All units bound
                    </span>
                  )}
                </div>

                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>

              <div className="border-t border-border bg-muted/20">
                {setup.stages.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-muted-foreground sm:px-5">
                    No stages are configured for this
                    programme.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {setup.stages
                      .slice()
                      .sort(
                        (a, b) =>
                          a.sequenceNumber -
                          b.sequenceNumber,
                      )
                      .map(
                        (
                          stage,
                          stageIndex,
                        ) => {
                          const selected =
                            new Set(
                              stage.unitIds,
                            );

                          return (
                            <details
                              key={stage.id}
                              open={
                                setupIndex === 0 &&
                                stageIndex === 0
                              }
                              className="group/stage bg-card"
                            >
                              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-muted/40 sm:px-5">
                                <div className="flex h-8 min-w-14 items-center justify-center rounded-md border border-border bg-background px-2 text-xs font-bold text-foreground">
                                  {stage.code}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-foreground">
                                    {stage.name}
                                  </div>

                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    Sequence{' '}
                                    {stage.sequenceNumber}
                                    {' Â· '}
                                    {
                                      stage.unitIds
                                        .length
                                    }{' '}
                                    {pluralize(
                                      stage.unitIds
                                        .length,
                                      'unit',
                                    )}{' '}
                                    bound
                                  </div>
                                </div>

                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/stage:rotate-180" />
                              </summary>

                              <form
                                action={
                                  saveProgrammeStageUnits
                                }
                                className="border-t border-border bg-background px-4 py-4 sm:px-5"
                              >
                                <input
                                  type="hidden"
                                  name="stageId"
                                  value={stage.id}
                                />

                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs text-muted-foreground">
                                    Select the units that
                                    belong to{' '}
                                    <span className="font-semibold text-foreground">
                                      {stage.code}
                                    </span>
                                    .
                                  </p>

                                  <button
                                    type="submit"
                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                    Save stage units
                                  </button>
                                </div>

                                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                  {setup.units.map(
                                    (unit) => (
                                      <label
                                        key={
                                          unit.id
                                        }
                                        className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 transition hover:border-primary/40 hover:bg-muted/30"
                                      >
                                        <input
                                          type="checkbox"
                                          name="unitIds"
                                          value={
                                            unit.id
                                          }
                                          defaultChecked={selected.has(
                                            unit.id,
                                          )}
                                          className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--primary)]"
                                        />

                                        <span className="min-w-0">
                                          <span className="block text-xs font-medium leading-5 text-foreground">
                                            {
                                              unit.name
                                            }
                                          </span>

                                          <span className="block text-[11px] text-muted-foreground">
                                            {
                                              unit.code
                                            }
                                          </span>
                                        </span>
                                      </label>
                                    ),
                                  )}
                                </div>
                              </form>
                            </details>
                          );
                        },
                      )}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

interface MetricProps {
  icon: typeof BookOpenCheck;
  label: string;
  value: number;
  warning?: boolean;
}

function Metric({
  icon: Icon,
  label,
  value,
  warning = false,
}: MetricProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div
        className={
          warning
            ? 'flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700'
            : 'flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary'
        }
      >
        <Icon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0">
        <div className="text-xl font-semibold leading-none text-foreground">
          {value}
        </div>

        <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}