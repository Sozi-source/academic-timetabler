import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildPrefilledUnitOfferingRows,
} from '@/features/imports/unit-offerings/prefilled-template';

const academicPeriod = {
  id: 'period-1',
  code: 'SEP-DEC-2026',
  name:
    'September\u2013December 2026',
};

const programmes = [
  {
    id: 'certificate',
    code: 'CND',
    name:
      'Certificate in Nutrition and Dietetics',
  },
  {
    id: 'diploma',
    code: 'DND',
    name:
      'Diploma in Nutrition and Dietetics',
  },
];

describe(
  'Prefilled Semester Offering rows',
  () => {
    it(
      'uses only the cohort programme and current stage',
      () => {
        const rows =
          buildPrefilledUnitOfferingRows({
            academicPeriod,
            programmes,
            cohorts: [
              {
                id: 'cohort-1',
                programmeId:
                  'certificate',
                code: 'CND-SEP-26',
                name:
                  'CND September 2026',
                currentAcademicPeriodNumber:
                  1,
              },
              {
                id: 'cohort-2',
                programmeId:
                  'diploma',
                code: 'DND-SEP-25',
                name:
                  'DND September 2025',
                currentAcademicPeriodNumber:
                  3,
              },
            ],
            units: [
              {
                id: 'certificate-stage-1',
                programmeId:
                  'certificate',
                code: 'CND-101',
                name:
                  'Communication Skills',
                academicPeriodNumber:
                  1,
                theoryHours: 30,
                practicalHours: 0,
                weeklySessions: 2,
              },
              {
                id: 'certificate-stage-2',
                programmeId:
                  'certificate',
                code: 'CND-201',
                name:
                  'Community Nutrition',
                academicPeriodNumber:
                  2,
                theoryHours: 30,
                practicalHours: 0,
                weeklySessions: 2,
              },
              {
                id: 'diploma-stage-3',
                programmeId:
                  'diploma',
                code: 'DND-301',
                name:
                  'Clinical Nutrition',
                academicPeriodNumber:
                  3,
                theoryHours: 30,
                practicalHours: 15,
                weeklySessions: 3,
              },
              {
                id: 'diploma-stage-1',
                programmeId:
                  'diploma',
                code: 'DND-101',
                name:
                  'Human Anatomy',
                academicPeriodNumber:
                  1,
                theoryHours: 30,
                practicalHours: 15,
                weeklySessions: 2,
              },
            ],
          });

        expect(rows).toHaveLength(2);

        expect(
          rows.map(
            (row) => row.unitCode,
          ),
        ).toEqual([
          'CND-101',
          'DND-301',
        ]);
      },
    );

    it(
      'keeps same-name units as separate programme-specific rows',
      () => {
        const rows =
          buildPrefilledUnitOfferingRows({
            academicPeriod,
            programmes,
            cohorts: [
              {
                id: 'certificate-cohort',
                programmeId:
                  'certificate',
                code: 'CND-SEP-26',
                name:
                  'CND September 2026',
                currentAcademicPeriodNumber:
                  1,
              },
              {
                id: 'diploma-cohort',
                programmeId:
                  'diploma',
                code: 'DND-SEP-26',
                name:
                  'DND September 2026',
                currentAcademicPeriodNumber:
                  1,
              },
            ],
            units: [
              {
                id: 'certificate-unit',
                programmeId:
                  'certificate',
                code: 'CND-105',
                name:
                  'Communication Skills',
                academicPeriodNumber:
                  1,
                theoryHours: 30,
                practicalHours: 0,
                weeklySessions: 2,
              },
              {
                id: 'diploma-unit',
                programmeId:
                  'diploma',
                code: 'DND-115',
                name:
                  'Communication Skills',
                academicPeriodNumber:
                  1,
                theoryHours: 30,
                practicalHours: 0,
                weeklySessions: 2,
              },
            ],
          });

        expect(rows).toHaveLength(2);

        expect(
          rows.map(
            (row) =>
              row.programmeName,
          ),
        ).toEqual([
          'Certificate in Nutrition and Dietetics',
          'Diploma in Nutrition and Dietetics',
        ]);

        expect(
          rows.map(
            (row) => row.unitCode,
          ),
        ).toEqual([
          'CND-105',
          'DND-115',
        ]);

        expect(
          rows.every(
            (row) =>
              row.sharedClassKey ===
              null,
          ),
        ).toBe(true);
      },
    );

    it(
      'identifies practical-heavy units',
      () => {
        const rows =
          buildPrefilledUnitOfferingRows({
            academicPeriod,
            programmes: [
              programmes[1],
            ],
            cohorts: [
              {
                id: 'diploma-cohort',
                programmeId:
                  'diploma',
                code: 'DND-SEP-26',
                name:
                  'DND September 2026',
                currentAcademicPeriodNumber:
                  2,
              },
            ],
            units: [
              {
                id: 'practical-unit',
                programmeId:
                  'diploma',
                code: 'DND-210',
                name:
                  'Food Preparation',
                academicPeriodNumber:
                  2,
                theoryHours: 15,
                practicalHours: 45,
                weeklySessions: 2,
              },
            ],
          });

        expect(
          rows[0]?.offeringType,
        ).toBe('practical');

        expect(
          rows[0]
            ?.sessionDurationMinutes,
        ).toBe(180);
      },
    );
  },
);