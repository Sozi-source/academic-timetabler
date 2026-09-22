import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createPlacementCandidates,
  suggestAlternativePlacements,
  type PlanningSession,
} from '@/features/timetable-generator';

import {
  baseSession,
  createConflictInput,
} from './fixtures';

function createSuggestionScenario() {
  const input =
    createConflictInput();

  const existingConflict:
  PlanningSession = {
    ...baseSession,
    id: 'existing-conflict',
    teachingAllocationId:
      'allocation-9',
    cohortId: 'cohort-2',
    unitId: 'unit-2',
    roomId: 'room-2',
  };

  const candidates =
    createPlacementCandidates({
      session: baseSession,
      workingDays:
        input.workingDays,
      timeRanges: [
        {
          startTimeSlotId:
            'slot-1',
          endTimeSlotId:
            'slot-2',
        },
        {
          startTimeSlotId:
            'slot-3',
          endTimeSlotId:
            'slot-3',
        },
      ],
      rooms: input.rooms,
    });

  return {
    input,
    existingConflict,
    candidates,
  };
}

describe(
  'suggestAlternativePlacements',
  () => {
    it('returns valid alternatives for a conflicting session', () => {
      const {
        input,
        existingConflict,
        candidates,
      } =
        createSuggestionScenario();

      const suggestions =
        suggestAlternativePlacements({
          conflictId:
            'trainer-conflict-1',
          session: baseSession,
          candidates,
          existingSessions: [
            existingConflict,
            baseSession,
          ],
          workingDays:
            input.workingDays,
          timeSlots:
            input.timeSlots,
          trainers:
            input.trainers,
          cohorts:
            input.cohorts,
          rooms:
            input.rooms,
          units:
            input.units,
        });

      expect(
        suggestions.length,
      ).toBeGreaterThan(0);

      expect(
        suggestions.every(
          (suggestion) =>
            suggestion.score > 0,
        ),
      ).toBe(true);
    });

    it('can recommend another day', () => {
      const {
        input,
        existingConflict,
        candidates,
      } =
        createSuggestionScenario();

      const suggestions =
        suggestAlternativePlacements({
          conflictId:
            'trainer-conflict-1',
          session: baseSession,
          candidates,
          existingSessions: [
            existingConflict,
            baseSession,
          ],
          workingDays:
            input.workingDays,
          timeSlots:
            input.timeSlots,
          trainers:
            input.trainers,
          cohorts:
            input.cohorts,
          rooms:
            input.rooms,
          units:
            input.units,
          limit: 20,
        });

      expect(
        suggestions.some(
          (suggestion) =>
            suggestion.changes.includes(
              'working_day',
            ),
        ),
      ).toBe(true);
    });

    it('can recommend another room', () => {
      const input =
        createConflictInput();

      input.rooms[1] = {
        ...input.rooms[1],
        roomType: 'lecture_room',
        capacity: 40,
      };

      const occupiedRoom:
      PlanningSession = {
        ...baseSession,
        id: 'occupied-room',
        teachingAllocationId:
          'allocation-9',
        trainerId: 'trainer-2',
        cohortId: 'cohort-2',
        unitId: 'unit-2',
      };

      const candidates =
        createPlacementCandidates({
          session: baseSession,
          workingDays: [
            input.workingDays[0],
          ],
          timeRanges: [
            {
              startTimeSlotId:
                'slot-1',
              endTimeSlotId:
                'slot-2',
            },
          ],
          rooms: input.rooms,
        });

      const suggestions =
        suggestAlternativePlacements({
          conflictId:
            'room-conflict-1',
          session: baseSession,
          candidates,
          existingSessions: [
            occupiedRoom,
            baseSession,
          ],
          workingDays:
            input.workingDays,
          timeSlots:
            input.timeSlots,
          trainers:
            input.trainers,
          cohorts:
            input.cohorts,
          rooms:
            input.rooms,
          units:
            input.units,
          limit: 20,
        });

      expect(
        suggestions.some(
          (suggestion) =>
            suggestion.changes.includes(
              'room',
            ) &&
            suggestion
              .proposedRoomId ===
              'room-2',
        ),
      ).toBe(true);
    });

    it('sorts suggestions by descending score', () => {
      const {
        input,
        existingConflict,
        candidates,
      } =
        createSuggestionScenario();

      const suggestions =
        suggestAlternativePlacements({
          conflictId:
            'trainer-conflict-1',
          session: baseSession,
          candidates,
          existingSessions: [
            existingConflict,
            baseSession,
          ],
          workingDays:
            input.workingDays,
          timeSlots:
            input.timeSlots,
          trainers:
            input.trainers,
          cohorts:
            input.cohorts,
          rooms:
            input.rooms,
          units:
            input.units,
        });

      for (
        let index = 1;
        index < suggestions.length;
        index += 1
      ) {
        expect(
          suggestions[index - 1]
            .score,
        ).toBeGreaterThanOrEqual(
          suggestions[index].score,
        );
      }
    });

    it('honours the suggestion limit', () => {
      const {
        input,
        existingConflict,
        candidates,
      } =
        createSuggestionScenario();

      const suggestions =
        suggestAlternativePlacements({
          conflictId:
            'trainer-conflict-1',
          session: baseSession,
          candidates,
          existingSessions: [
            existingConflict,
            baseSession,
          ],
          workingDays:
            input.workingDays,
          timeSlots:
            input.timeSlots,
          trainers:
            input.trainers,
          cohorts:
            input.cohorts,
          rooms:
            input.rooms,
          units:
            input.units,
          limit: 2,
        });

      expect(
        suggestions.length,
      ).toBeLessThanOrEqual(2);
    });

    it('never recommends a placement that violates a hard scheduling rule', () => {
      const {
        input,
        existingConflict,
        candidates,
      } = createSuggestionScenario();

      const suggestions =
        suggestAlternativePlacements({
          conflictId: 'trainer-conflict-1',
          session: baseSession,
          candidates,
          existingSessions: [
            existingConflict,
            baseSession,
          ],
          workingDays: input.workingDays,
          timeSlots: input.timeSlots,
          trainers: input.trainers,
          cohorts: input.cohorts,
          rooms: input.rooms,
          units: input.units,
          constraints: [{
            id: 'constraint-1',
            academicPeriodId: 'period-1',
            subjectType: 'institution',
            subjectId: null,
            constraintType: 'protected_day',
            workingDayId: 'day-1',
            startsAt: null,
            endsAt: null,
            priority: 'hard',
            reason: 'No teaching on Monday',
            isActive: true,
          }],
          limit: 20,
        });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(
        (suggestion) => suggestion.candidate.workingDayId !== 'day-1',
      )).toBe(true);
    });

    it('returns deterministic recommendations', () => {
      const {
        input,
        existingConflict,
        candidates,
      } =
        createSuggestionScenario();

      const generate = () =>
        suggestAlternativePlacements({
          conflictId:
            'trainer-conflict-1',
          session: baseSession,
          candidates,
          existingSessions: [
            existingConflict,
            baseSession,
          ],
          workingDays:
            input.workingDays,
          timeSlots:
            input.timeSlots,
          trainers:
            input.trainers,
          cohorts:
            input.cohorts,
          rooms:
            input.rooms,
          units:
            input.units,
        }).map(
          (suggestion) =>
            suggestion.id,
        );

      expect(generate()).toEqual(
        generate(),
      );
    });
  },
);
