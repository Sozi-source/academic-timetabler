import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/features/trainer-access/actions', () => ({
  provisionTrainerAccessAction: vi.fn(),
  generateTrainerAccessPinAction: vi.fn(),
}));

import { OnlineMarksEditor } from '@/features/staff-assessment/online-marks-editor';
import { TrainerAccessTable } from '@/features/trainer-access/trainer-access-table';
import type { TrainerAccessRecord } from '@/features/trainer-access/types';

const sampleStudents = [
  {
    studentId: 'stu-1',
    cohortId: 'coh-1',
    admissionNumber: 'DND/001/25',
    fullName: 'Ada Lovelace',
    cohortName: 'DND Sep 2025',
    attendanceStatus: 'expected' as const,
    catAbsent: false,
    initialMarks: {
      assignment: 4,
      presentation: 8,
      rat: 12,
      cat: 13,
      exam: null,
    },
  },
];

const sampleAccessRecords: TrainerAccessRecord[] = [
  {
    trainerId: 'tr-linked',
    fullName: 'Dr. Grace Hopper',
    email: 'grace@example.com',
    trainerActive: true,
    linkedProfileId: 'prof-1',
    matchedProfileId: 'prof-1',
    profileRole: 'staff',
    profileActive: true,
    accessState: 'linked',
  },
  {
    trainerId: 'tr-ready',
    fullName: 'Alan Turing',
    email: 'alan@example.com',
    trainerActive: true,
    linkedProfileId: null,
    matchedProfileId: 'prof-2',
    profileRole: 'staff',
    profileActive: true,
    accessState: 'ready_to_link',
  },
  {
    trainerId: 'tr-no-email',
    fullName: 'Katherine Johnson',
    email: null,
    trainerActive: true,
    linkedProfileId: null,
    matchedProfileId: null,
    profileRole: null,
    profileActive: null,
    accessState: 'email_required',
  },
];

describe('mobile action responsiveness and trainer access PIN visibility', () => {
  it('renders Submit CAT marks alongside closed exam notice in All marks mode with mobile stacking classes', () => {
    const html = renderToStaticMarkup(
      <OnlineMarksEditor
        assessmentId="ass-1"
        allowDraftDownload
        trainerEntryOpen
        trainerCatEntryOpen
        trainerExamEntryOpen={false}
        workflowStatus="draft"
        componentSubmissions={[]}
        students={sampleStudents}
      />,
    );

    expect(html).toContain('Final Exam Entry closed by HOD');
    expect(html).toContain('Submit CAT marks');
    expect(html).toContain('Download Draft Marksheet (.xlsx)');
    expect(html).toContain('flex-col-reverse items-stretch gap-2');
    expect(html).toContain('sm:flex-row sm:flex-wrap sm:items-center sm:justify-end');
    expect(html).toContain('min-h-11 sm:min-h-8');
    expect(html).toContain('w-full py-2 sm:w-auto');
  });

  it('keeps Submit CAT marks available in All marks mode when both CAT and Final windows are open and CAT is pending', () => {
    const html = renderToStaticMarkup(
      <OnlineMarksEditor
        assessmentId="ass-2"
        allowDraftDownload
        trainerEntryOpen
        trainerCatEntryOpen
        trainerExamEntryOpen
        workflowStatus="draft"
        componentSubmissions={[]}
        students={sampleStudents}
      />,
    );

    expect(html).toContain('Submit CAT marks');
    expect(html).toContain('Submit Final Marks');
  });

  it('does not show Submit CAT marks after CAT is submitted when exam entry is closed', () => {
    const html = renderToStaticMarkup(
      <OnlineMarksEditor
        assessmentId="ass-3"
        allowDraftDownload
        trainerEntryOpen
        trainerCatEntryOpen
        trainerExamEntryOpen={false}
        workflowStatus="draft"
        componentSubmissions={[
          {
            cohortId: 'coh-1',
            component: 'cat',
            submittedAt: '2026-11-11T10:00:00.000Z',
          },
        ]}
        students={sampleStudents}
      />,
    );

    expect(html).toContain('Download CAT Marksheet (.xlsx)');
    expect(html).toContain('Final Exam Entry closed by HOD');
    expect(html).not.toContain('Submit CAT marks');
  });

  it('renders Generate PIN buttons inside trainer-access-actions with touch-friendly responsive sizing', () => {
    const html = renderToStaticMarkup(
      <TrainerAccessTable records={sampleAccessRecords} variant="pin" />,
    );

    expect(html).toContain('trainer-access-actions');
    expect(html).toContain('Generate PIN');
    expect(html).toContain('Approve &amp; Link');
    expect(html).toContain('Add email');
    expect(html).toContain('min-h-11 sm:min-h-8');
  });

  it('overrides fixed DataTable heights and clipping on mobile card layout in globals.css', () => {
    const globalsCss = readFileSync(
      resolve(process.cwd(), 'src/app/globals.css'),
      'utf8',
    );
    const mobileBlockStart = globalsCss.indexOf('@media(max-width:1199px)');
    expect(mobileBlockStart).toBeGreaterThan(-1);
    const mobileBlockEnd = globalsCss.indexOf('/* Shell headers', mobileBlockStart);
    expect(mobileBlockEnd).toBeGreaterThan(mobileBlockStart);
    const mobileBlock = globalsCss.slice(mobileBlockStart, mobileBlockEnd);

    expect(mobileBlock).toContain('max-height:none!important');
    expect(mobileBlock).toContain('overflow:visible!important');
    expect(mobileBlock).toContain('height:auto!important;overflow:visible');
    expect(mobileBlock).toContain('height:auto!important;min-height:0!important');
    expect(mobileBlock).toContain('.trainer-access-register .trainer-access-actions');
  });
});
