import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  TeachingOfferingDetail,
  TeachingOfferingParticipantDetail,
} from '@/features/teaching-offerings';

describe(
  'Teaching Offering query contracts',
  () => {
    it(
      'represents different official unit codes within one shared offering',
      () => {
        const participants:
        TeachingOfferingParticipantDetail[] = [
          {
            id: 'participant-1',
            teachingOfferingId:
              'offering-1',
            cohortId: 'cohort-1',
            unitId:
              'certificate-unit',
            isPrimary: true,
            notes: null,
            createdBy: null,
            updatedBy: null,
            createdAt:
              '2026-08-02T00:00:00.000Z',
            updatedAt:
              '2026-08-02T00:00:00.000Z',
            cohort: {
              id: 'cohort-1',
              programmeId:
                'certificate-programme',
              code: 'CND-SEP-26',
              name:
                'Certificate September 2026',
              intakeDate:
                '2026-09-01',
              currentAcademicPeriodNumber:
                1,
              plannedSize: 25,
              actualSize: 24,
              programme: {
                id:
                  'certificate-programme',
                code: 'CND',
                name:
                  'Certificate in Nutrition and Dietetics',
                shortName: 'CND',
                awardLevel:
                  'certificate',
              },
            },
            unit: {
              id:
                'certificate-unit',
              programmeId:
                'certificate-programme',
              code: 'CND-101',
              name:
                'Communication Skills',
              shortName: null,
              academicPeriodNumber:
                1,
              preferredRoomType:
                'lecture_room',
              programme: null,
            },
          },
          {
            id: 'participant-2',
            teachingOfferingId:
              'offering-1',
            cohortId: 'cohort-2',
            unitId:
              'diploma-unit',
            isPrimary: false,
            notes: null,
            createdBy: null,
            updatedBy: null,
            createdAt:
              '2026-08-02T00:00:00.000Z',
            updatedAt:
              '2026-08-02T00:00:00.000Z',
            cohort: {
              id: 'cohort-2',
              programmeId:
                'diploma-programme',
              code: 'DND-SEP-26',
              name:
                'Diploma September 2026',
              intakeDate:
                '2026-09-01',
              currentAcademicPeriodNumber:
                1,
              plannedSize: 30,
              actualSize: 28,
              programme: {
                id:
                  'diploma-programme',
                code: 'DND',
                name:
                  'Diploma in Nutrition and Dietetics',
                shortName: 'DND',
                awardLevel: 'diploma',
              },
            },
            unit: {
              id: 'diploma-unit',
              programmeId:
                'diploma-programme',
              code: 'DND-105',
              name:
                'Communication Skills',
              shortName: null,
              academicPeriodNumber:
                1,
              preferredRoomType:
                'lecture_room',
              programme: null,
            },
          },
        ];

        expect(
          participants.map(
            (participant) =>
              participant.unit?.code,
          ),
        ).toEqual([
          'CND-101',
          'DND-105',
        ]);
      },
    );

    it(
      'supports a combined cohort size',
      () => {
        const offering =
          {
            participantCount: 2,
            combinedCohortSize: 52,
            isShared: true,
          } as TeachingOfferingDetail;

        expect(
          offering.combinedCohortSize,
        ).toBe(52);

        expect(
          offering.isShared,
        ).toBe(true);
      },
    );
  },
);