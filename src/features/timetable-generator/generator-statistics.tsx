import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  DoorOpen,
  UsersRound,
} from 'lucide-react';

import {
  MetricCard,
} from '@/components/ui/metric-card';

import type {
  GeneratorPreview,
} from './server-types';

export function GeneratorStatistics({
  preview,
}: {
  preview: GeneratorPreview;
}) {
  const {
    statistics,
  } = preview;

  return (
    <section
      aria-label="Timetable generation statistics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <MetricCard
        label="Sessions generated"
        value={String(
          statistics.scheduledSessionCount,
        )}
        description={`${statistics.requestedSessionCount} session requests processed`}
        icon={CalendarCheck2}
        status="Generated"
      />

      <MetricCard
        label="Unresolved sessions"
        value={String(
          statistics.unscheduledSessionCount,
        )}
        description="Requests requiring manual review"
        icon={AlertTriangle}
        status="Review"
      />

      <MetricCard
        label="Blocking conflicts"
        value={String(
          statistics.blockedConflictCount,
        )}
        description={`${statistics.warningCount} warning${
          statistics.warningCount === 1
            ? ''
            : 's'
        } detected`}
        icon={CheckCircle2}
        status="Conflicts"
      />

      <MetricCard
        label="Trainer utilization"
        value={`${statistics.trainerUtilizationPercentage}%`}
        description="Against configured weekly capacity"
        icon={UsersRound}
        status="Workload"
      />

      <MetricCard
        label="Room utilization"
        value={`${statistics.roomUtilizationPercentage}%`}
        description="Available teaching-room capacity"
        icon={DoorOpen}
        status="Rooms"
      />

      <MetricCard
        label="Generation time"
        value={`${statistics.generationDurationMilliseconds} ms`}
        description="Pure planner execution duration"
        icon={Clock3}
        status="Performance"
      />
    </section>
  );
}