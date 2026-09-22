import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildTimetableReports } from '@/features/timetable-reports/aggregation';
import {
  buildMasterTimetableDocx,
  buildPersonalTimetablesDocx,
} from '@/features/timetable-reports/template-docx';
import type { TimetableReportRow } from '@/features/timetable-reports/types';

const rows: TimetableReportRow[] = [
  {
    sessionId: 'communication-skills',
    day: 'Monday',
    daySequence: 1,
    startsAt: '08:00',
    endsAt: '10:00',
    durationMinutes: 120,
    cohort: 'CND September 2026',
    cohortSize: 35,
    participantCohorts: [
      { id: 'cnd', code: 'CND-SEP-2026', name: 'CND September 2026' },
      { id: 'dnd', code: 'DND-SEP-2026', name: 'DND September 2026' },
    ],
    unitCode: 'CND 1101',
    unitName: 'Communication Skills',
    trainerId: 'trainer-1',
    trainer: 'Trainer A',
    trainerTargetHours: 20,
    roomCode: null,
    roomName: 'No room assigned',
    departmentCode: 'HND',
    departmentName: 'Human Nutrition and Dietetics',
    status: 'draft',
    isLocked: false,
  },
  {
    sessionId: 'diet-therapy',
    day: 'Wednesday',
    daySequence: 3,
    startsAt: '10:30',
    endsAt: '12:30',
    durationMinutes: 120,
    cohort: 'DND September 2026',
    cohortSize: 32,
    participantCohorts: [
      { id: 'dnd', code: 'DND-SEP-2026', name: 'DND September 2026' },
    ],
    unitCode: 'DND 2204',
    unitName: 'Diet Therapy III',
    trainerId: null,
    trainer: 'Unassigned trainer',
    trainerTargetHours: 0,
    roomCode: null,
    roomName: 'No room assigned',
    status: 'draft',
    isLocked: false,
  },
];

describe('buildMasterTimetableDocx', () => {
  it('creates an editable Word timetable', async () => {
    const buffer = await buildMasterTimetableDocx({
      data: buildTimetableReports(rows),
      departmentName: 'Human Nutrition and Dietetics',
      periodLabel: 'September-December 2026 (SEP-DEC-26)',
      generatedOn: '16 August 2026',
    });

    expect(buffer.length).toBeGreaterThan(5_000);
    expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK');

    if (process.env.DOCX_QA_OUTPUT_DIR) {
      const outputDirectory = path.resolve(process.env.DOCX_QA_OUTPUT_DIR);
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(path.join(outputDirectory, 'master-timetable.docx'), buffer);
    }
  });

  it('creates editable institution-wide personal trainer timetables', async () => {
    const personalRows: TimetableReportRow[] = [
      rows[0],
      {
        ...rows[0],
        sessionId: 'nursing-session',
        day: 'Thursday',
        daySequence: 4,
        startsAt: '14:00',
        endsAt: '16:00',
        cohort: 'Nursing September 2026',
        participantCohorts: [
          { id: 'nursing', code: 'NUR-SEP-2026', name: 'Nursing September 2026' },
        ],
        unitCode: 'NUR 2103',
        unitName: 'Community Health',
        departmentCode: 'NUR',
        departmentName: 'Nursing',
      },
    ];
    const buffer = await buildPersonalTimetablesDocx({
      data: buildTimetableReports(personalRows),
      periodLabel: 'September-December 2026 (SEP-DEC-26)',
      generatedOn: '16 August 2026',
    });

    expect(buffer.length).toBeGreaterThan(5_000);
    expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK');

    if (process.env.DOCX_QA_OUTPUT_DIR) {
      const outputDirectory = path.resolve(process.env.DOCX_QA_OUTPUT_DIR);
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(
        path.join(outputDirectory, 'personal-trainer-timetables.docx'),
        buffer,
      );
    }
  });
});
