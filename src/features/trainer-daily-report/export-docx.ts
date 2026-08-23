import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  PageNumber,
  PageOrientation,
  Paragraph,
  Packer,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import {
  formatDailyReportDate,
  formatDailyReportTime,
} from './domain';
import type { DepartmentDailyReportWorkspace } from './types';

const border = { style: BorderStyle.SINGLE, size: 4, color: '555555' } as const;
const borders = { top: border, bottom: border, left: border, right: border } as const;
const FONT = 'Arial';

function p(
  text: string,
  options: {
    bold?: boolean;
    size?: number;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
  } = {},
) {
  return new Paragraph({
    alignment: options.align ?? AlignmentType.LEFT,
    spacing: { before: options.before ?? 0, after: options.after ?? 60, line: 260 },
    children: [
      new TextRun({
        text,
        font: FONT,
        bold: options.bold ?? false,
        size: options.size ?? 19, // 9.5pt in half-points
        color: options.color ?? '111827',
      }),
    ],
  });
}

function cell(
  content: Paragraph | Paragraph[] | string,
  options: {
    bold?: boolean;
    size?: number;
    color?: string;
    bg?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    widthPercent?: number;
    colSpan?: number;
  } = {},
) {
  let paragraphs: Paragraph[];
  if (typeof content === 'string') {
    paragraphs = [p(content, { bold: options.bold, size: options.size, color: options.color, align: options.align })];
  } else if (Array.isArray(content)) {
    paragraphs = content;
  } else {
    paragraphs = [content];
  }

  return new TableCell({
    children: paragraphs,
    shading: options.bg ? { fill: options.bg } : undefined,
    borders,
    columnSpan: options.colSpan,
    width: options.widthPercent ? { size: options.widthPercent, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

export async function buildTrainerDailyReportDocx(
  workspace: DepartmentDailyReportWorkspace,
): Promise<Buffer> {
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png');
    logoBuffer = await readFile(logoPath);
  } catch (err) {
    console.warn('Could not load college logo for daily report docx export:', err);
  }

  const submissionRate = workspace.summary.expectedTrainers > 0
    ? `${Math.round((workspace.summary.submittedReports / workspace.summary.expectedTrainers) * 100)}%`
    : '100%';

  const children: (Paragraph | Table)[] = [];

  // 1. Header Banner
  const headerParagraphs: Paragraph[] = [];
  if (logoBuffer) {
    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 64, height: 64 },
            type: 'png',
          }),
        ],
      }),
    );
  }

  headerParagraphs.push(
    p('IMPERIAL COLLEGE OF MEDICAL & HEALTH SCIENCES', {
      bold: true,
      size: 26,
      align: AlignmentType.CENTER,
      after: 40,
    }),
    p(
      workspace.departmentName.toUpperCase().startsWith('DEPARTMENT')
        ? workspace.departmentName.toUpperCase()
        : `DEPARTMENT OF ${workspace.departmentName.toUpperCase()}`,
      {
        bold: true,
        size: 21,
        align: AlignmentType.CENTER,
        color: '0369A1',
        after: 40,
      },
    ),
    p('TRAINERS DAILY REPORT & TEACHING OPERATIONS SUMMARY', {
      bold: true,
      size: 21,
      align: AlignmentType.CENTER,
      after: 40,
    }),
    p(`Report Date: ${formatDailyReportDate(workspace.reportDate)} | Generated: ${new Date(workspace.generatedAt).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' })}`, {
      size: 18,
      align: AlignmentType.CENTER,
      color: '4B5563',
      after: 140,
    }),
  );

  children.push(...headerParagraphs);

  // 2. Executive KPI Summary Table
  children.push(
    p('1. EXECUTIVE OPERATIONS SUMMARY', { bold: true, size: 21, before: 100, after: 60 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell('Expected Trainers', { bold: true, bg: 'E5E7EB', align: AlignmentType.CENTER, widthPercent: 20 }),
            cell('Reports Received', { bold: true, bg: 'E5E7EB', align: AlignmentType.CENTER, widthPercent: 20 }),
            cell('Submission Rate', { bold: true, bg: 'E5E7EB', align: AlignmentType.CENTER, widthPercent: 20 }),
            cell('Recorded Absences', { bold: true, bg: 'E5E7EB', align: AlignmentType.CENTER, widthPercent: 20 }),
            cell('Flagged Concerns', { bold: true, bg: 'E5E7EB', align: AlignmentType.CENTER, widthPercent: 20 }),
          ],
        }),
        new TableRow({
          children: [
            cell(String(workspace.summary.expectedTrainers), { bold: true, size: 22, align: AlignmentType.CENTER }),
            cell(String(workspace.summary.submittedReports), { bold: true, size: 22, align: AlignmentType.CENTER }),
            cell(submissionRate, { bold: true, size: 22, color: '047857', align: AlignmentType.CENTER }),
            cell(String(workspace.summary.recordedAbsences), { bold: true, size: 22, align: AlignmentType.CENTER }),
            cell(String(workspace.summary.concerns), {
              bold: true,
              size: 22,
              color: workspace.summary.concerns > 0 ? 'B91C1C' : '111827',
              align: AlignmentType.CENTER,
            }),
          ],
        }),
      ],
    }),
  );

  // 3. Pending Trainers (if any)
  if (workspace.pendingTrainers.length > 0) {
    children.push(
      p('2. PENDING SUBMISSIONS (TRAINERS WITH OUTSTANDING REPORTS)', {
        bold: true,
        size: 20,
        color: 'B45309',
        before: 140,
        after: 40,
      }),
      p(
        `The following ${workspace.pendingTrainers.length} trainer(s) have not yet submitted their daily report for this date: ${workspace.pendingTrainers.map((t) => t.trainerName).join(', ')}.`,
        { size: 18, color: '92400E', after: 120 },
      ),
    );
  }

  // 4. Detailed Submitted Reports
  children.push(
    p('3. INDIVIDUAL TRAINER DAILY REPORTS', { bold: true, size: 21, before: 140, after: 80 }),
  );

  if (workspace.reports.length === 0) {
    children.push(
      p('No trainer reports have been submitted for this date yet.', { size: 19, color: '6B7280', after: 120 }),
    );
  } else {
    for (let idx = 0; idx < workspace.reports.length; idx++) {
      const report = workspace.reports[idx];
      const trainerHeading = `${idx + 1}. ${report.trainerName}${report.trainerNumber ? ` (${report.trainerNumber})` : ''} — ${report.homeDepartmentName}`;

      children.push(
        p(trainerHeading, { bold: true, size: 20, color: '1E3A8A', before: 100, after: 30 }),
        p(`Submitted at: ${new Date(report.submittedAt).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' })}`, {
          size: 17,
          color: '4B5563',
          after: 60,
        }),
      );

      // Lessons table
      const lessons = report.lessons ?? [];
      if (lessons.length > 0) {
        const lessonRows = [
          new TableRow({
            tableHeader: true,
            children: [
              cell('Time', { bold: true, bg: 'F3F4F6', widthPercent: 15 }),
              cell('Unit', { bold: true, bg: 'F3F4F6', widthPercent: 28 }),
              cell('Cohort / Class', { bold: true, bg: 'F3F4F6', widthPercent: 20 }),
              cell('Present', { bold: true, bg: 'F3F4F6', align: AlignmentType.CENTER, widthPercent: 10 }),
              cell('Absent', { bold: true, bg: 'F3F4F6', align: AlignmentType.CENTER, widthPercent: 10 }),
              cell('Absentee Students', { bold: true, bg: 'F3F4F6', widthPercent: 17 }),
            ],
          }),
        ];

        for (const lesson of lessons) {
          const absenteeText = (lesson.absentees ?? []).length > 0
            ? lesson.absentees.map((a) => `${a.fullName} (${a.admissionNumber})`).join('; ')
            : 'None';

          lessonRows.push(
            new TableRow({
              children: [
                cell(`${formatDailyReportTime(lesson.startsAt)} - ${formatDailyReportTime(lesson.endsAt)}`),
                cell(`${lesson.unitCode ? `${lesson.unitCode} - ` : ''}${lesson.unitName}`, { bold: true }),
                cell(lesson.cohortName || 'Class'),
                cell(String(lesson.presentCount || 0), { align: AlignmentType.CENTER }),
                cell(String(lesson.absentCount || 0), {
                  bold: (lesson.absentCount || 0) > 0,
                  color: (lesson.absentCount || 0) > 0 ? 'B91C1C' : '111827',
                  align: AlignmentType.CENTER,
                }),
                cell(absenteeText, { size: 17 }),
              ],
            }),
          );
        }

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: lessonRows,
          }),
        );
      } else {
        children.push(
          p('• No scheduled teaching sessions on timetable for this date.', { size: 18, color: '6B7280', after: 40 }),
        );
      }

      // Other activity & concern notes
      if (report.otherActivity || report.concern) {
        const noteCells: TableCell[] = [];

        if (report.otherActivity) {
          noteCells.push(
            cell([
              p('Other Daily Activity:', { bold: true, size: 18, color: '374151', after: 20 }),
              p(report.otherActivity, { size: 18, after: 0 }),
            ], { bg: 'F9FAFB', widthPercent: report.concern ? 50 : 100 }),
          );
        }

        if (report.concern) {
          noteCells.push(
            cell([
              p('Concern / Urgent Action Required:', { bold: true, size: 18, color: 'B91C1C', after: 20 }),
              p(report.concern, { size: 18, color: '7F1D1D', after: 0 }),
            ], { bg: 'FEF2F2', widthPercent: report.otherActivity ? 50 : 100 }),
          );
        }

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [new TableRow({ children: noteCells })],
          }),
        );
      }

      children.push(p('', { after: 100 }));
    }
  }

  // 5. Sign-off & Institutional Review Section
  children.push(
    p('4. DEPARTMENTAL REVIEW & SIGN-OFF', { bold: true, size: 21, before: 160, after: 80 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: [
            cell([
              p('Compiled & Verified By (HOD):', { bold: true, size: 18, after: 80 }),
              p('Name: _____________________________________', { size: 18, after: 80 }),
              p('Signature: __________________ Date: ________', { size: 18, after: 40 }),
            ], { widthPercent: 50, bg: 'F9FAFB' }),
            cell([
              p('Reviewed By (Academic Registrar / Principal):', { bold: true, size: 18, after: 80 }),
              p('Name: _____________________________________', { size: 18, after: 80 }),
              p('Signature & Stamp: ___________ Date: _______', { size: 18, after: 40 }),
            ], { widthPercent: 50, bg: 'F9FAFB' }),
          ],
        }),
      ],
    }),
  );

  // 6. Build the Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            pageRanges: false,
            orientation: PageOrientation.LANDSCAPE,
            margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5 in margins
          },
        },
        headers: {
          default: new Header({
            children: [
              p('Imperial College of Medical & Health Sciences | Trainers Daily Report', {
                size: 16,
                color: '9CA3AF',
                align: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Page ', font: FONT, size: 16, color: '9CA3AF' }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '9CA3AF' }),
                  new TextRun({ text: ' of ', font: FONT, size: 16, color: '9CA3AF' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: '9CA3AF' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
