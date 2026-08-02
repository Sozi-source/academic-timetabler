import {
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Plus,
  School,
  Sparkles,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';

const metrics = [
  {
    label: 'Academic period',
    value: 'Not set',
    description: 'Create the active teaching period',
    icon: CalendarDays,
    status: 'Required',
  },
  {
    label: 'Active cohorts',
    value: '0',
    description: 'No cohorts configured yet',
    icon: School,
    status: 'Setup',
  },
  {
    label: 'Units running',
    value: '0',
    description: 'Across active programmes',
    icon: BookOpen,
    status: 'Setup',
  },
  {
    label: 'Trainers',
    value: '0',
    description: 'Available teaching staff',
    icon: UserRound,
    status: 'Setup',
  },
  {
    label: 'Teaching rooms',
    value: '0',
    description: 'Available scheduling resources',
    icon: Building2,
    status: 'Setup',
  },
];

const quickActions = [
  {
    label: 'Academic period',
    href: '/timetable/academic-periods',
    icon: CalendarDays,
  },
  {
    label: 'Programme',
    href: '/timetable/programmes',
    icon: GraduationCap,
  },
  {
    label: 'Cohort',
    href: '/timetable/cohorts',
    icon: School,
  },
  {
    label: 'Trainer',
    href: '/timetable/trainers',
    icon: UserRound,
  },
];

const setupSteps = [
  'Create the active academic period',
  'Configure working days and lesson times',
  'Register teaching rooms',
  'Add programmes and cohorts',
  'Register units and trainers',
  'Create teaching allocations',
];

export default async function DashboardPage() {
  const profile = await requireHodAccess();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Department overview"
        title="Academic operations"
        description="Prepare the academic structure and departmental resources required to produce a reliable timetable."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">
              Human Nutrition and Dietetics
            </Badge>

            <Badge variant="warning" dot>
              Academic period not configured
            </Badge>

            <Badge variant="success" dot>
              Secure session
            </Badge>
          </div>
        }
      />

      <section
        aria-label="Department metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            {...metric}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Setup progress
            </p>

            <h2 className="mt-2 text-lg font-semibold text-text-primary">
              Timetable readiness
            </h2>

            <p className="mt-1 text-sm text-text-secondary">
              Complete these steps before generating the
              first departmental timetable.
            </p>
          </CardHeader>

          <CardContent>
            <ol className="grid gap-3 sm:grid-cols-2">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Quick actions
            </p>

            <h2 className="mt-2 text-lg font-semibold text-text-primary">
              Start configuration
            </h2>
          </CardHeader>

          <CardContent className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex min-h-11 items-center justify-between rounded-xl border border-border-soft px-3.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    Add {action.label}
                  </span>

                  <Plus
                    className="size-4 text-text-subtle transition group-hover:text-primary"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Recent activity
                </p>

                <h2 className="mt-2 text-lg font-semibold text-text-primary">
                  Department changes
                </h2>
              </div>

              <CalendarClock
                className="size-5 text-text-muted"
                aria-hidden="true"
              />
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-xl border border-dashed border-border-strong bg-surface-subtle px-5 py-8 text-center">
              <p className="text-sm font-medium text-text-primary">
                No recent activity
              </p>

              <p className="mt-1 text-xs leading-5 text-text-muted">
                Configuration changes will appear here.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                  System insights
                </p>

                <h2 className="mt-2 text-lg font-semibold text-text-primary">
                  Readiness guidance
                </h2>
              </div>

              <Sparkles
                className="size-5 text-primary"
                aria-hidden="true"
              />
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-start gap-3 rounded-xl border border-info-border bg-info-surface px-4 py-4">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-info"
                aria-hidden="true"
              />

              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Authentication is operational
                </p>

                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  Welcome, {profile.fullName}. The next
                  required component is Academic Period
                  Management.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}