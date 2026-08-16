import {
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  GeneratorSourceData,
} from '@/features/timetable-generator/queries';

vi.mock('server-only', () => ({}));

let createAutomaticPlannerInput:
  typeof import(
    '@/features/timetable-generator/data-adapter'
  )['createAutomaticPlannerInput'];

let createGeneratorPreview:
  typeof import(
    '@/features/timetable-generator/data-adapter'
  )['createGeneratorPreview'];

let createGeneratorReadiness:
  typeof import(
    '@/features/timetable-generator/data-adapter'
  )['createGeneratorReadiness'];

beforeAll(async () => {
  const adapter =
    await import(
      '@/features/timetable-generator/data-adapter'
    );

  createAutomaticPlannerInput =
    adapter.createAutomaticPlannerInput;

  createGeneratorPreview =
    adapter.createGeneratorPreview;

  createGeneratorReadiness =
    adapter.createGeneratorReadiness;
});

function createSourceData():
GeneratorSourceData {
  return {
    academicPeriod: {
      id: 'period-1',
      academicYearId: 'year-1',
      academicYear: {
        id: 'year-1',
        name: '2026',
        startsOn: '2026-01-01',
        endsOn: '2026-12-31',
        status: 'active',
      },
      name: 'Semester 2',
      code: '2026-S2',
      sequenceNumber: 2,
      startsOn: '2026-05-01',
      endsOn: '2026-08-31',
      teachingStartsOn:
        '2026-05-04',
      teachingEndsOn:
        '2026-08-21',
      status: 'active',
      notes: null,
      createdBy: null,
      updatedBy: null,
      createdAt:
        '2026-05-01T00:00:00.000Z',
      updatedAt:
        '2026-05-01T00:00:00.000Z',
    },

    allocations: [
      {
        id: 'allocation-1',
        academicPeriodId:
          'period-1',
        cohortId: 'cohort-1',
        unitId: 'unit-1',
        trainerId: 'trainer-1',
        preferredRoomId: null,
        deliveryMode: 'theory',
        weeklySessions: 1,
        sessionDurationMinutes:
          120,
        status: 'active',
        isTimetableEnabled: true,
        notes: null,
        createdBy: null,
        updatedBy: null,
        createdAt:
          '2026-05-01T00:00:00.000Z',
        updatedAt:
          '2026-05-01T00:00:00.000Z',
        academicPeriod: null,
        cohort: null,
        unit: null,
        trainer: null,
        preferredRoom: null,
      },
    ],

    workingDays: [
      {
        id: 'day-1',
        academicPeriodId:
          'period-1',
        dayOfWeek: 'monday',
        sequenceNumber: 1,
        isEnabled: true,
        notes: null,
        createdAt:
          '2026-05-01T00:00:00.000Z',
        updatedAt:
          '2026-05-01T00:00:00.000Z',
      },
    ],

    timeSlots: [
      {
        id: 'slot-1',
        academicPeriodId:
          'period-1',
        name: 'First hour',
        code: 'S1',
        slotType: 'teaching',
        startsAt: '08:00',
        endsAt: '09:00',
        sequenceNumber: 1,
        isEnabled: true,
        notes: null,
        createdAt:
          '2026-05-01T00:00:00.000Z',
        updatedAt:
          '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'slot-2',
        academicPeriodId:
          'period-1',
        name: 'Second hour',
        code: 'S2',
        slotType: 'teaching',
        startsAt: '09:00',
        endsAt: '10:00',
        sequenceNumber: 2,
        isEnabled: true,
        notes: null,
        createdAt:
          '2026-05-01T00:00:00.000Z',
        updatedAt:
          '2026-05-01T00:00:00.000Z',
      },
    ],

    trainers: [
      {
        id: 'trainer-1',
        profileId: null,
        staffNumber: 'TR-001',
        fullName: 'Trainer One',
        email: null,
        phoneNumber: null,
        employmentType:
          'full_time',
        availabilityMode:
          'selected_slots_only',
        specialization: null,
        qualifications: null,
        normalWeeklyHours: 20,
        maximumWeeklyHours: 24,
        maximumDailyHours: 6,
        isActive: true,
        isTimetableAvailable: true,
        notes: null,
        createdBy: null,
        updatedBy: null,
        createdAt:
          '2026-05-01T00:00:00.000Z',
        updatedAt:
          '2026-05-01T00:00:00.000Z',
      },
    ],

    trainerAvailability: [
      {
        trainerId: 'trainer-1',
        workingDayId: 'day-1',
        timeSlotId: 'slot-1',
      },
      {
        trainerId: 'trainer-1',
        workingDayId: 'day-1',
        timeSlotId: 'slot-2',
      },
    ],

    constraints: [],

    cohorts: [
      {
        id: 'cohort-1',
        programmeId:
          'programme-1',
        code: 'COH-1',
        name: 'Cohort One',
        intakeDate: '2026-01-01',
        expectedCompletionDate:
          '2027-12-31',
        currentAcademicPeriodNumber:
          2,
        plannedSize: 30,
        actualSize: 30,
        status: 'active',
        isTimetableAvailable: true,
        notes: null,
        createdBy: null,
        updatedBy: null,
        createdAt:
          '2026-05-01T00:00:00.000Z',
        updatedAt:
          '2026-05-01T00:00:00.000Z',
        programme: null,
      },
    ],

    rooms: [
      {
        id: 'room-1',
        code: 'R-1',
        name: 'Room One',
        roomType:
          'lecture_room',
        building: null,
        floorLabel: null,
        capacity: 40,
        isAccessible: true,
        isActive: true,
        isTimetableAvailable: true,
        notes: null,
        createdBy: null,
        updatedBy: null,
        createdAt:
          '2026-05-01T00:00:00.000Z',
        updatedAt:
          '2026-05-01T00:00:00.000Z',
      },
    ],

    units: [
      {
        id: 'unit-1',
        programmeId:
          'programme-1',
        code: 'NUT-101',
        name: 'Nutrition One',
        shortName: null,
        category: 'core',
        academicPeriodNumber: 2,
        theoryHours: 30,
        practicalHours: 0,
        weeklySessions: 1,
        preferredRoomType:
          'lecture_room',
        isActive: true,
        isTimetableAvailable: true,
        notes: null,
        createdBy: null,
        updatedBy: null,
        createdAt:
          '2026-05-01T00:00:00.000Z',
        updatedAt:
          '2026-05-01T00:00:00.000Z',
        programme: null,
      },
    ],

    existingSessions: [],
  };
}

describe(
  'generator data adapter',
  () => {
    it(
      'maps source data into planner input',
      () => {
        const input =
          createAutomaticPlannerInput({
            sourceData:
              createSourceData(),
          });

        expect(
          input.allocations,
        ).toHaveLength(1);

        expect(
          input.trainers[0]
            .maximumWeeklyHours,
        ).toBe(24);

        expect(
          input.trainers[0]
            .normalWeeklyHours,
        ).toBe(20);

        expect(
          input.trainers[0]
            .availabilityMode,
        ).toBe('selected_slots_only');

        expect(
          input.trainers[0]
            .availableSlots,
        ).toEqual([
          {
            workingDayId: 'day-1',
            timeSlotId: 'slot-1',
          },
          {
            workingDayId: 'day-1',
            timeSlotId: 'slot-2',
          },
        ]);

        expect(
          input.rooms[0].roomType,
        ).toBe('lecture_room');
      },
    );

    it(
      'reports a ready generator configuration',
      () => {
        const readiness =
          createGeneratorReadiness(
            createSourceData(),
          );

        expect(
          readiness.isReady,
        ).toBe(true);

        expect(
          readiness.issues,
        ).toEqual([]);
      },
    );

    it(
      'reports missing timetable allocations',
      () => {
        const sourceData =
          createSourceData();

        sourceData.allocations = [];

        const readiness =
          createGeneratorReadiness(
            sourceData,
          );

        expect(
          readiness.isReady,
        ).toBe(false);

        expect(
          readiness.issues,
        ).toContain(
          'No timetable-enabled teaching allocations are available.',
        );
      },
    );

    it(
      'creates a serializable generated preview',
      () => {
        const preview =
          createGeneratorPreview({
            sourceData:
              createSourceData(),
            generatedAt:
              '2026-08-02T18:00:00.000Z',
          });

        expect(
          preview.sessions,
        ).toHaveLength(1);

        expect(
          preview.sessions[0]
            .trainerName,
        ).toBe('Trainer One');

        expect(
          preview.sessions[0]
            .durationMinutes,
        ).toBe(120);

        expect(
          preview.generatedAt,
        ).toBe(
          '2026-08-02T18:00:00.000Z',
        );

        expect(
          preview.exchangeSuggestionsEvaluated,
        ).toBe(true);
      },
    );

    it(
      'can build a fast preview without rescanning every trainer exchange',
      () => {
        const preview =
          createGeneratorPreview({
            sourceData:
              createSourceData(),
            includeExchangeSuggestions:
              false,
          });

        expect(
          preview.exchangeSuggestionsEvaluated,
        ).toBe(false);
      },
    );

    it(
      'exposes a protected timetable before generator changes are applied',
      () => {
        const sourceData =
          createSourceData();

        sourceData.protectedTimetable = {
          id: 'version-2',
          versionNumber: 2,
          status: 'published',
        };

        const preview =
          createGeneratorPreview({
            sourceData,
          });

        expect(
          preview.protectedTimetable,
        ).toEqual({
          id: 'version-2',
          versionNumber: 2,
          status: 'published',
        });
      },
    );

    it(
      'preserves only locked sessions when overwrite is enabled',
      () => {
        const sourceData =
          createSourceData();

        sourceData.existingSessions = [
          {
            id: 'draft-session',
            academic_period_id:
              'period-1',
            teaching_allocation_id:
              'allocation-old',
            cohort_id: 'cohort-1',
            unit_id: 'unit-1',
            trainer_id: 'trainer-1',
            working_day_id: 'day-1',
            start_time_slot_id:
              'slot-1',
            end_time_slot_id:
              'slot-2',
            room_id: 'room-1',
            session_number: 1,
            delivery_mode: 'theory',
            status: 'draft',
            source: 'manual',
            conflict_state: 'clear',
            is_locked: false,
            notes: null,
            created_at:
              '2026-05-01T00:00:00.000Z',
            updated_at:
              '2026-05-01T00:00:00.000Z',
          },
          {
            id: 'locked-session',
            academic_period_id:
              'period-1',
            teaching_allocation_id:
              'allocation-locked',
            cohort_id: 'cohort-1',
            unit_id: 'unit-1',
            trainer_id: 'trainer-1',
            working_day_id: 'day-1',
            start_time_slot_id:
              'slot-1',
            end_time_slot_id:
              'slot-2',
            room_id: 'room-1',
            session_number: 1,
            delivery_mode: 'theory',
            status: 'locked',
            source: 'manual',
            conflict_state: 'clear',
            is_locked: true,
            notes: null,
            created_at:
              '2026-05-01T00:00:00.000Z',
            updated_at:
              '2026-05-01T00:00:00.000Z',
          },
        ];

        const input =
          createAutomaticPlannerInput({
            sourceData,
            overwriteExisting: true,
          });

        expect(
          input.existingSessions,
        ).toHaveLength(1);

        expect(
          input.existingSessions?.[0]
            .id,
        ).toBe('locked-session');
      },
    );
  },
);
