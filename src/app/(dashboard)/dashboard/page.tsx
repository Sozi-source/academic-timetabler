import {
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  School,
  UserRound,
} from 'lucide-react';

import { requireHodAccess } from '@/features/auth/authorization';

const summaryCards = [
  {
    label: 'Academic period',
    value: 'Not configured',
    detail: 'Create the first teaching period',
    icon: CalendarDays,
  },
  {
    label: 'Active cohorts',
    value: '0',
    detail: 'No cohorts registered',
    icon: School,
  },
  {
    label: 'Units offered',
    value: '0',
    detail: 'No units configured',
    icon: BookOpen,
  },
  {
    label: 'Trainers',
    value: '0',
    detail: 'No trainers registered',
    icon: UserRound,
  },
  {
    label: 'Rooms',
    value: '0',
    detail: 'No rooms registered',
    icon: Building2,
  },
];

const setupSteps = [
  'Create an academic period',
  'Configure working days and time slots',
  'Register teaching rooms',
  'Add programmes and active cohorts',
  'Register units and trainers',
  'Create teaching allocations',
];

export default async function DashboardPage() {
  const profile = await requireHodAccess();

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Department overview
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            Welcome, {profile.fullName}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
            Complete the core timetable configuration
            before generating the department schedule.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-success-border bg-success-surface px-3 py-1.5 text-xs font-semibold text-success">
          <span className="size-1.5 rounded-full bg-success" />
          Secure session active
        </div>
      </header>

      <section
        aria-label="Timetable overview"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.label}
              className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon
                  className="size-5"
                  aria-hidden="true"
                />
              </div>

              <p className="mt-5 text-2xl font-semibold tracking-tight text-text-primary">
                {card.value}
              </p>

              <p className="mt-1 text-sm font-medium text-text-primary">
                {card.label}
              </p>

              <p className="mt-1 text-xs leading-5 text-text-muted">
                {card.detail}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Setup progress
            </p>

            <h2 className="mt-2 text-lg font-semibold text-text-primary">
              Timetable preparation checklist
            </h2>

            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Complete these foundations in sequence.
            </p>
          </div>

          <ol className="mt-6 grid gap-3 sm:grid-cols-2">
            {setupSteps.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-xl border border-border-soft bg-surface-subtle px-4 py-3"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-xs font-semibold text-text-secondary">
                  {index + 1}
                </span>

                <span className="pt-1 text-sm text-text-secondary">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-sm)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-success-surface text-success">
            <CheckCircle2
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-text-primary">
            Platform foundation
          </h2>

          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Authentication, secure session refresh and
            role-based HOD access are operational.
          </p>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
              Next component
            </p>

            <p className="mt-2 text-sm font-semibold text-primary">
              Academic period management
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}