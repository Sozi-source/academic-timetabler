import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type React from 'react';
import { describe, expect, it } from 'vitest';

import { buildTimetableReports } from '@/features/timetable-reports/aggregation';
import { TimetableTemplateDocument } from '@/features/timetable-reports/template-pdf';
import type { TimetableReportRow } from '@/features/timetable-reports/types';

const rows: TimetableReportRow[] = [
  {
    sessionId: 'assigned',
    day: 'Monday',
    daySequence: 1,
    startsAt: '08:00',
    endsAt: '10:00',
    durationMinutes: 120,
    cohort: 'CND September 2026',
    cohortSize: 64,
    participantCohorts: [
      { id: 'cnd', code: 'CND-SEP-2026', name: 'CND September 2026' },
      { id: 'dnd', code: 'DND-SEP-2026', name: 'DND September 2026' },
    ],
    unitCode: 'CND 1101',
    unitName: 'Communication Skills',
    trainerId: 'trainer-a',
    trainer: 'Trainer A',
    trainerTargetHours: 20,
    roomCode: null,
    roomName: 'No room assigned',
    status: 'draft',
    isLocked: false,
  },
  {
    sessionId: 'unassigned',
    day: 'Tuesday',
    daySequence: 2,
    startsAt: '14:00',
    endsAt: '16:00',
    durationMinutes: 120,
    cohort: 'DND September 2026',
    cohortSize: 32,
    participantCohorts: [
      { id: 'dnd', code: 'DND-SEP-2026', name: 'DND September 2026' },
    ],
    unitCode: 'DND 1105',
    unitName: 'Human Anatomy and Physiology',
    trainerId: null,
    trainer: 'Unassigned trainer',
    trainerTargetHours: 0,
    roomCode: null,
    roomName: 'No room assigned',
    status: 'draft',
    isLocked: false,
  },
];

describe('TimetableTemplateDocument', () => {
  it.each(['master', 'trainer'] as const)('renders the %s institutional PDF', async (report) => {
    const denseMasterRows = report === 'master'
      ? Array.from({ length: 14 }, (_, index): TimetableReportRow => ({
          ...rows[0],
          sessionId: `dense-${index}`,
          cohort: `Cohort ${index + 1}`,
          participantCohorts: [{
            id: `cohort-${index + 1}`,
            code: `COHORT-${String(index + 1).padStart(2, '0')}`,
            name: `Cohort ${index + 1}`,
          }],
        }))
      : [];
    const element = (
      <TimetableTemplateDocument
        report={report}
        data={buildTimetableReports([...rows, ...denseMasterRows])}
        departmentName="Human Nutrition and Dietetics"
        periodLabel="September-December 2026 (SEP-DEC-26)"
        generatedOn="16 August 2026"
      />
    );
    const buffer = await renderToBuffer(
      element as unknown as React.ReactElement<DocumentProps>,
    );

    expect(buffer.length).toBeGreaterThan(1_000);
    const pageCount = buffer
      .toString('latin1')
      .match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    expect(pageCount).toBe(report === 'master' ? 5 : 1);

    if (process.env.PDF_QA_OUTPUT_DIR) {
      const outputDirectory = path.resolve(process.env.PDF_QA_OUTPUT_DIR);
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(path.join(outputDirectory, `${report}.pdf`), buffer);
    }
  });
});
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
