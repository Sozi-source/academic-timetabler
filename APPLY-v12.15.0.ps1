$ErrorActionPreference = "Stop"
Set-Location "C:\Users\sozi\Desktop\academic-timetabler"

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required file not found: $Path"
    }

    return [System.IO.File]::ReadAllText(
        (Resolve-Path -LiteralPath $Path).Path
    )
}

function Write-Text([string]$Path, [string]$Content) {
    $full = [System.IO.Path]::GetFullPath(
        (Join-Path $PWD.Path $Path)
    )

    $parent = [System.IO.Path]::GetDirectoryName($full)

    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $full,
        $Content,
        $utf8
    )
}

Write-Host ""
Write-Host "Applying v12.15.0 Programme Stage Unit Binding..." -ForegroundColor Cyan

# ============================================================
# 1. DATABASE MIGRATION
# Adaptive: create a dedicated programme_stage_units binding table
# without assuming an existing column on units/programme_stages.
# ============================================================

$migration = @'
create table if not exists public.programme_stage_units (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null,
  programme_id uuid not null,
  programme_stage_id uuid not null,
  unit_id uuid not null,
  created_at timestamptz not null default now(),

  constraint programme_stage_units_programme_stage_unit_unique
    unique (programme_stage_id, unit_id),

  constraint programme_stage_units_stage_fkey
    foreign key (programme_stage_id)
    references public.programme_stages(id)
    on delete cascade,

  constraint programme_stage_units_unit_fkey
    foreign key (unit_id)
    references public.units(id)
    on delete cascade,

  constraint programme_stage_units_programme_fkey
    foreign key (programme_id)
    references public.programmes(id)
    on delete cascade
);

create index if not exists programme_stage_units_department_idx
  on public.programme_stage_units(department_id);

create index if not exists programme_stage_units_programme_idx
  on public.programme_stage_units(programme_id);

create index if not exists programme_stage_units_stage_idx
  on public.programme_stage_units(programme_stage_id);

create index if not exists programme_stage_units_unit_idx
  on public.programme_stage_units(unit_id);

alter table public.programme_stage_units enable row level security;

drop policy if exists programme_stage_units_authenticated_read
  on public.programme_stage_units;

create policy programme_stage_units_authenticated_read
on public.programme_stage_units
for select
to authenticated
using (true);

drop policy if exists programme_stage_units_authenticated_write
  on public.programme_stage_units;

create policy programme_stage_units_authenticated_write
on public.programme_stage_units
for all
to authenticated
using (true)
with check (true);
'@

$migrationPath =
    "supabase\migrations\20260817114500_programme_stage_unit_binding.sql"

Write-Text $migrationPath $migration
Write-Host "Created migration: $migrationPath" -ForegroundColor Green

# ============================================================
# 2. FEATURE TYPES
# ============================================================

$typesPath =
    "src\features\programme-stages\unit-binding-types.ts"

$types = @'
export interface ProgrammeStageUnitOption {
  id: string;
  code: string;
  name: string;
  category: string;
  academicPeriodNumber: number | null;
  isActive: boolean;
  isBound: boolean;
}

export interface ProgrammeStageUnitBindingSetup {
  stageId: string;
  programmeId: string;
  programmeCode: string;
  stageCode: string | null;
  stageName: string;
  boundUnitCount: number;
  units: ProgrammeStageUnitOption[];
}
'@

Write-Text $typesPath $types

# ============================================================
# 3. SERVER QUERIES
# ============================================================

$queriesPath =
    "src\features\programme-stages\unit-binding-queries.ts"

$queries = @'
import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  ProgrammeStageUnitBindingSetup,
} from './unit-binding-types';

export const getProgrammeStageUnitBindingSetup = cache(
  async (
    stageId: string,
  ): Promise<ProgrammeStageUnitBindingSetup> => {
    const supabase = await createClient();

    const stageResult = await supabase
      .from('programme_stages')
      .select(`
        id,
        programme_id,
        code,
        name,
        programmes (
          id,
          code,
          department_id
        )
      `)
      .eq('id', stageId)
      .single();

    if (stageResult.error) {
      throw new Error(
        `Unable to load programme stage: ${stageResult.error.message}`,
      );
    }

    const stage = stageResult.data;
    const programme = Array.isArray(stage.programmes)
      ? stage.programmes[0]
      : stage.programmes;

    if (!programme) {
      throw new Error(
        'Programme stage has no programme relation.',
      );
    }

    const [unitResult, bindingResult] =
      await Promise.all([
        supabase
          .from('units')
          .select(
            'id, code, name, category, academic_period_number, is_active',
          )
          .eq(
            'programme_id',
            stage.programme_id,
          )
          .order('academic_period_number', {
            ascending: true,
          })
          .order('name', {
            ascending: true,
          }),

        supabase
          .from('programme_stage_units')
          .select('unit_id')
          .eq(
            'programme_stage_id',
            stage.id,
          ),
      ]);

    if (unitResult.error) {
      throw new Error(
        `Unable to load programme units: ${unitResult.error.message}`,
      );
    }

    if (bindingResult.error) {
      throw new Error(
        `Unable to load stage bindings: ${bindingResult.error.message}`,
      );
    }

    const boundIds = new Set(
      (bindingResult.data ?? []).map(
        (binding) =>
          binding.unit_id as string,
      ),
    );

    const units = (unitResult.data ?? []).map(
      (unit) => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
        category: unit.category,
        academicPeriodNumber:
          unit.academic_period_number,
        isActive: unit.is_active,
        isBound: boundIds.has(unit.id),
      }),
    );

    return {
      stageId: stage.id,
      programmeId:
        stage.programme_id,
      programmeCode:
        programme.code,
      stageCode:
        stage.code,
      stageName:
        stage.name,
      boundUnitCount:
        units.filter(
          (unit) =>
            unit.isBound,
        ).length,
      units,
    };
  },
);
'@

Write-Text $queriesPath $queries

# ============================================================
# 4. SERVER ACTION
# ============================================================

$actionsPath =
    "src\features\programme-stages\unit-binding-actions.ts"

$actions = @'
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function saveProgrammeStageUnitBindingsAction(
  formData: FormData,
) {
  const stageId =
    String(
      formData.get('stageId') ?? '',
    ).trim();

  if (!stageId) {
    throw new Error(
      'Programme stage is required.',
    );
  }

  const selectedUnitIds =
    formData
      .getAll('unitIds')
      .map((value) =>
        String(value),
      )
      .filter(Boolean);

  const supabase = await createClient();

  const stageResult = await supabase
    .from('programme_stages')
    .select(`
      id,
      programme_id,
      programmes (
        id,
        department_id
      )
    `)
    .eq('id', stageId)
    .single();

  if (stageResult.error) {
    throw new Error(
      `Unable to load programme stage: ${stageResult.error.message}`,
    );
  }

  const stage = stageResult.data;
  const programme = Array.isArray(stage.programmes)
    ? stage.programmes[0]
    : stage.programmes;

  if (!programme) {
    throw new Error(
      'Programme stage has no programme relation.',
    );
  }

  if (selectedUnitIds.length > 0) {
    const unitValidation = await supabase
      .from('units')
      .select('id')
      .eq(
        'programme_id',
        stage.programme_id,
      )
      .in(
        'id',
        selectedUnitIds,
      );

    if (unitValidation.error) {
      throw new Error(
        `Unable to validate selected units: ${unitValidation.error.message}`,
      );
    }

    if (
      (unitValidation.data ?? []).length !==
      selectedUnitIds.length
    ) {
      throw new Error(
        'One or more selected units do not belong to this programme.',
      );
    }
  }

  const deleteResult = await supabase
    .from('programme_stage_units')
    .delete()
    .eq(
      'programme_stage_id',
      stage.id,
    );

  if (deleteResult.error) {
    throw new Error(
      `Unable to clear existing stage bindings: ${deleteResult.error.message}`,
    );
  }

  if (selectedUnitIds.length > 0) {
    const insertResult = await supabase
      .from('programme_stage_units')
      .insert(
        selectedUnitIds.map(
          (unitId) => ({
            department_id:
              programme.department_id,
            programme_id:
              stage.programme_id,
            programme_stage_id:
              stage.id,
            unit_id:
              unitId,
          }),
        ),
      );

    if (insertResult.error) {
      throw new Error(
        `Unable to save stage unit bindings: ${insertResult.error.message}`,
      );
    }
  }

  revalidatePath(
    '/timetable/programme-stages',
  );
  revalidatePath(
    '/students/unit-registration/batch',
  );
  revalidatePath(
    '/students/unit-registration',
  );

  redirect(
    `/timetable/programme-stages/${stage.id}/units?saved=1`,
  );
}
'@

Write-Text $actionsPath $actions

# ============================================================
# 5. CLIENT FORM
# ============================================================

$formPath =
    "src\features\programme-stages\programme-stage-unit-binding-form.tsx"

$form = @'
'use client';

import {
  CheckCircle2,
  Search,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  saveProgrammeStageUnitBindingsAction,
} from './unit-binding-actions';
import type {
  ProgrammeStageUnitBindingSetup,
} from './unit-binding-types';

interface ProgrammeStageUnitBindingFormProps {
  setup: ProgrammeStageUnitBindingSetup;
}

export function ProgrammeStageUnitBindingForm({
  setup,
}: ProgrammeStageUnitBindingFormProps) {
  const [query, setQuery] =
    useState('');

  const [selected, setSelected] =
    useState<Set<string>>(
      () =>
        new Set(
          setup.units
            .filter(
              (unit) =>
                unit.isBound,
            )
            .map(
              (unit) =>
                unit.id,
            ),
        ),
    );

  const filteredUnits = useMemo(
    () => {
      const normalized =
        query.trim().toLowerCase();

      if (!normalized) {
        return setup.units;
      }

      return setup.units.filter(
        (unit) =>
          unit.name
            .toLowerCase()
            .includes(normalized) ||
          unit.code
            .toLowerCase()
            .includes(normalized) ||
          unit.category
            .toLowerCase()
            .includes(normalized),
      );
    },
    [
      query,
      setup.units,
    ],
  );

  const selectedCount =
    selected.size;

  const allVisibleSelected =
    filteredUnits.length > 0 &&
    filteredUnits.every(
      (unit) =>
        selected.has(unit.id),
    );

  function toggleUnit(
    unitId: string,
  ) {
    setSelected(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(unitId)
        ) {
          next.delete(unitId);
        }
        else {
          next.add(unitId);
        }

        return next;
      },
    );
  }

  function toggleVisible() {
    setSelected(
      (current) => {
        const next =
          new Set(current);

        if (
          allVisibleSelected
        ) {
          filteredUnits.forEach(
            (unit) =>
              next.delete(
                unit.id,
              ),
          );
        }
        else {
          filteredUnits.forEach(
            (unit) =>
              next.add(
                unit.id,
              ),
          );
        }

        return next;
      },
    );
  }

  return (
    <form
      action={
        saveProgrammeStageUnitBindingsAction
      }
      className="space-y-4"
    >
      <input
        type="hidden"
        name="stageId"
        value={setup.stageId}
      />

      {Array.from(
        selected,
      ).map(
        (unitId) => (
          <input
            key={unitId}
            type="hidden"
            name="unitIds"
            value={unitId}
          />
        ),
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {selectedCount}{' '}
            {selectedCount === 1
              ? 'unit'
              : 'units'}{' '}
            selected
          </p>

          <p className="mt-1 text-xs text-text-muted">
            Select the curriculum
            units taught at this
            stage.
          </p>
        </div>

        <Button
          type="submit"
          leadingIcon={
            <CheckCircle2
              className="size-4"
              aria-hidden="true"
            />
          }
        >
          Save bindings
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <Input
            value={query}
            onChange={
              (event) =>
                setQuery(
                  event.target.value,
                )
            }
            placeholder="Search units..."
            className="pl-9"
          />
        </div>

        <button
          type="button"
          onClick={
            toggleVisible
          }
          className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
        >
          {allVisibleSelected
            ? 'Unselect visible'
            : 'Select visible'}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_100px_90px] border-b border-border bg-surface-subtle px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          <span />
          <span>Unit</span>
          <span>Category</span>
          <span>Period</span>
        </div>

        <div className="divide-y divide-border">
          {filteredUnits.map(
            (unit) => {
              const checked =
                selected.has(
                  unit.id,
                );

              return (
                <label
                  key={unit.id}
                  className="grid cursor-pointer grid-cols-[44px_minmax(0,1fr)_100px_90px] items-center px-3 py-3 transition hover:bg-surface-subtle"
                >
                  <input
                    type="checkbox"
                    checked={
                      checked
                    }
                    onChange={() =>
                      toggleUnit(
                        unit.id,
                      )
                    }
                    className="size-4"
                  />

                  <span className="min-w-0 pr-4">
                    <span className="block text-sm font-semibold text-text-primary">
                      {unit.name}
                    </span>

                    <span className="mt-0.5 block text-[11px] text-text-muted">
                      {unit.code}
                    </span>
                  </span>

                  <span className="text-xs text-text-secondary">
                    {unit.category}
                  </span>

                  <span className="text-xs font-medium text-text-secondary">
                    {unit.academicPeriodNumber
                      ? `P${unit.academicPeriodNumber}`
                      : '-'}
                  </span>
                </label>
              );
            },
          )}

          {filteredUnits.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-text-muted">
              No units match this
              search.
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}
'@

Write-Text $formPath $form

# ============================================================
# 6. PAGE
# ============================================================

$pagePath =
    "src\app\(dashboard)\timetable\programme-stages\[stageId]\units\page.tsx"

$page = @'
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpenCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  ProgrammeStageUnitBindingForm,
} from '@/features/programme-stages/programme-stage-unit-binding-form';
import {
  getProgrammeStageUnitBindingSetup,
} from '@/features/programme-stages/unit-binding-queries';

interface ProgrammeStageUnitsPageProps {
  params: Promise<{
    stageId: string;
  }>;
  searchParams: Promise<{
    saved?: string;
  }>;
}

export default async function ProgrammeStageUnitsPage({
  params,
  searchParams,
}: ProgrammeStageUnitsPageProps) {
  const {
    stageId,
  } = await params;

  const query =
    await searchParams;

  const setup =
    await getProgrammeStageUnitBindingSetup(
      stageId,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Programme structure"
        title={`${setup.programmeCode} - ${setup.stageName}`}
        description="Bind curriculum units to this programme stage."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {setup.stageCode ??
                'Stage'}
            </Badge>

            <Badge
              variant={
                setup.boundUnitCount > 0
                  ? 'success'
                  : 'warning'
              }
            >
              {setup.boundUnitCount}{' '}
              {setup.boundUnitCount === 1
                ? 'unit'
                : 'units'}{' '}
              bound
            </Badge>
          </div>
        }
        actions={
          <Link
            href="/timetable/programme-stages"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to stages
          </Link>
        }
      />

      {query.saved === '1' ? (
        <div className="rounded-xl border border-success-border bg-success-surface px-4 py-3 text-sm font-medium text-success-text">
          Stage unit bindings
          saved successfully.
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)] sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpenCheck
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Stage curriculum
            </h2>

            <p className="mt-1 text-sm text-text-muted">
              Only units belonging
              to {setup.programmeCode}
              are shown.
            </p>
          </div>
        </div>

        <ProgrammeStageUnitBindingForm
          setup={setup}
        />
      </section>
    </div>
  );
}
'@

Write-Text $pagePath $page

# ============================================================
# 7. PATCH PROGRAMME STAGES UI WITH MANAGE UNITS LINK
# Best-effort, safe insertion against known stage cards/buttons.
# ============================================================

$stageFiles = Get-ChildItem `
    ".\src\features\programme-stages" `
    -Recurse `
    -File `
    -Filter "*.tsx" `
    -ErrorAction SilentlyContinue

$patchedStageUi = $false

foreach ($stageFile in $stageFiles) {
    $stageContent =
        [System.IO.File]::ReadAllText(
            $stageFile.FullName
        )

    if (
        $stageContent.Contains(
          "/timetable/programme-stages/"
        ) -or
        $stageContent.Contains(
          "programme-stages/${"
        )
    ) {
        continue
    }

    if (
        $stageContent.Contains(
          "stage.name"
        ) -and
        $stageContent.Contains(
          "stage.id"
        )
    ) {
        if (
            -not $stageContent.Contains(
                "Manage units"
            )
        ) {
            $button = @'
<Link
  href={`/timetable/programme-stages/${stage.id}/units`}
  className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
>
  Manage units
</Link>
'@

            $candidate =
                $stageContent.IndexOf(
                    "</div>",
                    $stageContent.IndexOf(
                        "stage.name"
                    )
                )

            if ($candidate -ge 0) {
                $stageContent =
                    $stageContent.Insert(
                        $candidate,
                        "`n" +
                        $button +
                        "`n"
                    )

                [System.IO.File]::WriteAllText(
                    $stageFile.FullName,
                    $stageContent,
                    $utf8
                )

                $patchedStageUi =
                    $true

                Write-Host `
                    "Added Manage units link: $($stageFile.FullName)" `
                    -ForegroundColor Green

                break
            }
        }
    }
}

if (-not $patchedStageUi) {
    Write-Warning "Programme Stages list was not patched automatically. The new binding route is available directly at /timetable/programme-stages/<stageId>/units."
}

# ============================================================
# 8. PATCH BATCH REGISTRATION QUERY TO USE NEW BINDINGS
# Best-effort: add canonical relation helper if file exists.
# ============================================================

$batchQuery =
    "src\features\student-unit-registration\cohort-stage-queries.ts"

if (Test-Path -LiteralPath $batchQuery) {
    $batchContent =
        Read-Text $batchQuery

    if (
        -not $batchContent.Contains(
            "programme_stage_units"
        )
    ) {
        Write-Warning "Batch registration query does not yet reference programme_stage_units. The stage binding foundation is installed, but batch consumption still needs a targeted follow-up once its current query shape is inspected."
    }
    else {
        Write-Host "Batch registration already references stage-unit bindings." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "v12.15.0 source patch applied successfully." -ForegroundColor Green
Write-Host "Migration included: 20260817114500_programme_stage_unit_binding.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  1. npx supabase db push" -ForegroundColor Gray
Write-Host "  2. npm run typecheck" -ForegroundColor Gray
Write-Host "  3. npm run lint" -ForegroundColor Gray
Write-Host "  4. npm run dev" -ForegroundColor Gray
