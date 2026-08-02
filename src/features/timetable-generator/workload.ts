import type {
  WeekdayCode,
} from '@/features/timetable-calendar/types';

import {
  resolveSessionInterval,
} from './session-time';
import {
  resolveMinuteInterval,
} from './time';
import type {
  MinuteInterval,
  PlanningConflict,
  PlanningSession,
  PlanningTimeSlot,
  PlanningTrainer,
  PlanningWorkingDay,
} from './types';

export interface TrainerDailyWorkload {
  workingDayId: string;
  dayOfWeek: WeekdayCode;
  sessionIds: string[];
  teachingMinutes: number;
  teachingHours: number;
  idleMinutes: number;
  largestIdleGapMinutes: number;
  longestContinuousBlockMinutes: number;
  utilizationPercentage: number;
  exceedsDailyLimit: boolean;
}

export interface TrainerWorkloadAnalysis {
  trainerId: string;
  trainerName: string;
  maximumDailyHours: number;
  maximumWeeklyHours: number;
  daily: TrainerDailyWorkload[];
  weeklyTeachingMinutes: number;
  weeklyTeachingHours: number;
  weeklyIdleMinutes: number;
  weeklyUtilizationPercentage: number;
  exceedsWeeklyLimit: boolean;
}

export interface WorkloadAnalysisOptions {
  fatigueWarningMinutes?: number;
}

interface SessionIntervalRecord {
  sessionId: string;
  interval: MinuteInterval;
}

interface DayWorkloadAccumulator {
  workingDay: PlanningWorkingDay;
  intervals: SessionIntervalRecord[];
}

function buildLookup<T extends {
  id: string;
}>(
  values: T[],
): Map<string, T> {
  return new Map(
    values.map((value) => [
      value.id,
      value,
    ]),
  );
}

function isActiveSession(
  session: PlanningSession,
) {
  return ![
    'cancelled',
    'archived',
  ].includes(session.status);
}

function mergeIntervals(
  intervals: MinuteInterval[],
): MinuteInterval[] {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals].sort(
    (first, second) =>
      first.startMinutes -
        second.startMinutes ||
      first.endMinutes -
        second.endMinutes,
  );

  const merged: MinuteInterval[] = [
    {
      ...sorted[0],
    },
  ];

  for (
    let index = 1;
    index < sorted.length;
    index += 1
  ) {
    const current = sorted[index];
    const previous =
      merged[merged.length - 1];

    if (
      current.startMinutes <=
      previous.endMinutes
    ) {
      previous.endMinutes = Math.max(
        previous.endMinutes,
        current.endMinutes,
      );

      continue;
    }

    merged.push({
      ...current,
    });
  }

  return merged;
}

function sumIntervalMinutes(
  intervals: MinuteInterval[],
) {
  return intervals.reduce(
    (total, interval) =>
      total +
      interval.endMinutes -
      interval.startMinutes,
    0,
  );
}

function calculateIdleMetrics(
  mergedIntervals: MinuteInterval[],
) {
  if (mergedIntervals.length < 2) {
    return {
      idleMinutes: 0,
      largestIdleGapMinutes: 0,
    };
  }

  let idleMinutes = 0;
  let largestIdleGapMinutes = 0;

  for (
    let index = 1;
    index < mergedIntervals.length;
    index += 1
  ) {
    const previous =
      mergedIntervals[index - 1];

    const current =
      mergedIntervals[index];

    const gap =
      current.startMinutes -
      previous.endMinutes;

    idleMinutes += gap;

    largestIdleGapMinutes = Math.max(
      largestIdleGapMinutes,
      gap,
    );
  }

  return {
    idleMinutes,
    largestIdleGapMinutes,
  };
}

function calculateLongestBlock(
  mergedIntervals: MinuteInterval[],
) {
  return mergedIntervals.reduce(
    (longest, interval) =>
      Math.max(
        longest,
        interval.endMinutes -
          interval.startMinutes,
      ),
    0,
  );
}

function calculateUtilizationPercentage({
  teachingMinutes,
  idleMinutes,
}: {
  teachingMinutes: number;
  idleMinutes: number;
}) {
  const occupiedWindow =
    teachingMinutes + idleMinutes;

  if (occupiedWindow <= 0) {
    return 0;
  }

  return Number(
    (
      teachingMinutes /
      occupiedWindow *
      100
    ).toFixed(1),
  );
}

export function analyzeTrainerWorkloads({
  sessions,
  trainers,
  workingDays,
  timeSlots,
}: {
  sessions: PlanningSession[];
  trainers: PlanningTrainer[];
  workingDays: PlanningWorkingDay[];
  timeSlots: PlanningTimeSlot[];
}): TrainerWorkloadAnalysis[] {
  const trainerLookup =
    buildLookup(trainers);

  const workingDayLookup =
    buildLookup(workingDays);

  const timeSlotLookup =
    buildLookup(timeSlots);

  const trainerDays = new Map<
    string,
    Map<string, DayWorkloadAccumulator>
  >();

  for (
    const session of
    sessions.filter(isActiveSession)
  ) {
    const trainer =
      trainerLookup.get(
        session.trainerId,
      );

    const workingDay =
      workingDayLookup.get(
        session.workingDayId,
      );

    if (!trainer || !workingDay) {
      continue;
    }

    let interval: MinuteInterval;

    try {
      interval =
        resolveMinuteInterval(
          resolveSessionInterval({
            session,
            timeSlots:
              timeSlotLookup,
          }),
        );
    }
    catch {
      continue;
    }

    const dayMap =
      trainerDays.get(trainer.id) ??
      new Map<
        string,
        DayWorkloadAccumulator
      >();

    const day =
      dayMap.get(workingDay.id) ?? {
        workingDay,
        intervals: [],
      };

    day.intervals.push({
      sessionId: session.id,
      interval,
    });

    dayMap.set(
      workingDay.id,
      day,
    );

    trainerDays.set(
      trainer.id,
      dayMap,
    );
  }

  return trainers.map((trainer) => {
    const dayMap =
      trainerDays.get(trainer.id) ??
      new Map<
        string,
        DayWorkloadAccumulator
      >();

    const daily = Array.from(
      dayMap.values(),
    )
      .sort(
        (first, second) =>
          first.workingDay
            .sequenceNumber -
          second.workingDay
            .sequenceNumber,
      )
      .map((day) => {
        const mergedIntervals =
          mergeIntervals(
            day.intervals.map(
              (record) =>
                record.interval,
            ),
          );

        const teachingMinutes =
          sumIntervalMinutes(
            mergedIntervals,
          );

        const {
          idleMinutes,
          largestIdleGapMinutes,
        } = calculateIdleMetrics(
          mergedIntervals,
        );

        const longestContinuousBlockMinutes =
          calculateLongestBlock(
            mergedIntervals,
          );

        return {
          workingDayId:
            day.workingDay.id,
          dayOfWeek:
            day.workingDay.dayOfWeek,
          sessionIds:
            day.intervals.map(
              (record) =>
                record.sessionId,
            ),
          teachingMinutes,
          teachingHours:
            teachingMinutes / 60,
          idleMinutes,
          largestIdleGapMinutes,
          longestContinuousBlockMinutes,
          utilizationPercentage:
            calculateUtilizationPercentage({
              teachingMinutes,
              idleMinutes,
            }),
          exceedsDailyLimit:
            teachingMinutes >
            trainer.maximumDailyHours *
              60,
        };
      });

    const weeklyTeachingMinutes =
      daily.reduce(
        (total, day) =>
          total +
          day.teachingMinutes,
        0,
      );

    const weeklyIdleMinutes =
      daily.reduce(
        (total, day) =>
          total +
          day.idleMinutes,
        0,
      );

    return {
      trainerId: trainer.id,
      trainerName:
        trainer.fullName,
      maximumDailyHours:
        trainer.maximumDailyHours,
      maximumWeeklyHours:
        trainer.maximumWeeklyHours,
      daily,
      weeklyTeachingMinutes,
      weeklyTeachingHours:
        weeklyTeachingMinutes / 60,
      weeklyIdleMinutes,
      weeklyUtilizationPercentage:
        calculateUtilizationPercentage({
          teachingMinutes:
            weeklyTeachingMinutes,
          idleMinutes:
            weeklyIdleMinutes,
        }),
      exceedsWeeklyLimit:
        weeklyTeachingMinutes >
        trainer.maximumWeeklyHours *
          60,
    };
  });
}

function createWorkloadConflict({
  type,
  trainer,
  sessionIds,
  message,
  workingDayId,
  metadata,
  severity = 'blocked',
}: {
  type:
    | 'trainer_daily_workload'
    | 'trainer_weekly_workload';
  trainer: PlanningTrainer;
  sessionIds: string[];
  message: string;
  workingDayId?: string;
  metadata: Record<
    string,
    string | number | boolean | null
  >;
  severity?: 'warning' | 'blocked';
}): PlanningConflict {
  return {
    id: [
      type,
      trainer.id,
      workingDayId ?? 'week',
    ].join('|'),
    type,
    severity,
    message,
    sessionIds:
      Array.from(
        new Set(sessionIds),
      ).sort(),
    resourceId: trainer.id,
    resourceLabel:
      trainer.fullName,
    workingDayId,
    metadata,
  };
}

export function detectTrainerWorkloadConflicts({
  sessions,
  trainers,
  workingDays,
  timeSlots,
  options = {},
}: {
  sessions: PlanningSession[];
  trainers: PlanningTrainer[];
  workingDays: PlanningWorkingDay[];
  timeSlots: PlanningTimeSlot[];
  options?: WorkloadAnalysisOptions;
}): PlanningConflict[] {
  const analyses =
    analyzeTrainerWorkloads({
      sessions,
      trainers,
      workingDays,
      timeSlots,
    });

  const trainerLookup =
    buildLookup(trainers);

  const fatigueWarningMinutes =
    options.fatigueWarningMinutes ??
    240;

  const conflicts: PlanningConflict[] =
    [];

  for (const analysis of analyses) {
    const trainer =
      trainerLookup.get(
        analysis.trainerId,
      );

    if (!trainer) {
      continue;
    }

    for (const day of analysis.daily) {
      if (day.exceedsDailyLimit) {
        conflicts.push(
          createWorkloadConflict({
            type:
              'trainer_daily_workload',
            trainer,
            sessionIds:
              day.sessionIds,
            workingDayId:
              day.workingDayId,
            message:
              `${trainer.fullName} has ${day.teachingHours.toFixed(
                1,
              )} teaching hours on ${day.dayOfWeek}, exceeding the daily limit of ${trainer.maximumDailyHours} hours.`,
            metadata: {
              dayOfWeek:
                day.dayOfWeek,
              teachingMinutes:
                day.teachingMinutes,
              maximumMinutes:
                trainer.maximumDailyHours *
                60,
            },
          }),
        );
      }
      else if (
        day.longestContinuousBlockMinutes >
        fatigueWarningMinutes
      ) {
        conflicts.push(
          createWorkloadConflict({
            type:
              'trainer_daily_workload',
            severity: 'warning',
            trainer,
            sessionIds:
              day.sessionIds,
            workingDayId:
              day.workingDayId,
            message:
              `${trainer.fullName} has a continuous teaching block of ${day.longestContinuousBlockMinutes} minutes on ${day.dayOfWeek}.`,
            metadata: {
              dayOfWeek:
                day.dayOfWeek,
              longestContinuousBlockMinutes:
                day.longestContinuousBlockMinutes,
              fatigueWarningMinutes,
            },
          }),
        );
      }
    }

    if (analysis.exceedsWeeklyLimit) {
      conflicts.push(
        createWorkloadConflict({
          type:
            'trainer_weekly_workload',
          trainer,
          sessionIds:
            analysis.daily.flatMap(
              (day) =>
                day.sessionIds,
            ),
          message:
            `${trainer.fullName} has ${analysis.weeklyTeachingHours.toFixed(
              1,
            )} weekly teaching hours, exceeding the limit of ${trainer.maximumWeeklyHours} hours.`,
          metadata: {
            teachingMinutes:
              analysis.weeklyTeachingMinutes,
            maximumMinutes:
              trainer.maximumWeeklyHours *
              60,
          },
        }),
      );
    }
  }

  return conflicts;
}