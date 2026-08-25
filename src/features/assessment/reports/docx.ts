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

import type { AssessmentPeriodReportData } from './queries';

const border = { style: BorderStyle.SINGLE, size: 4, color: '444444' } as const;
const borders = { top: border, bottom: border, left: border, right: border } as const;
const FONT = 'Times New Roman';

function clean(value: string | null | undefined, fallback = '—') {
  const text = value?.trim();
  return text ? text : fallback;
}

function periodUpper(name: string) {
  return name.toUpperCase().replace(/\s+/g, ' ').trim();
}

function departmentTitle(name: string) {
  const upper = name.toUpperCase();
  return upper.startsWith('DEPARTMENT OF ') ? upper : `DEPARTMENT OF ${upper}`;
}

function p(
  text: string,
  options: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
    underline?: boolean;
  } = {},
) {
  return new Paragraph({
    alignment: options.align ?? AlignmentType.LEFT,
    spacing: { before: options.before ?? 0, after: options.after ?? 80, line: 276 },
    children: [
      new TextRun({
        text,
        font: FONT,
        bold: options.bold,
        size: options.size ?? 20,
        ...(options.underline ? { underline: {} } : {}),
      }),
    ],
  });
}

function body(text: string) {
  return p(text, { align: AlignmentType.JUSTIFIED, after: 100 });
}

function heading(text: string) {
  return p(text, { bold: true, underline: true, size: 20, before: 120, after: 80 });
}

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 50, line: 276 },
    children: [new TextRun({ text, font: FONT, size: 20 })],
  });
}

function cell(
  text: string | number,
  options: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    fill?: string;
    size?: number;
  } = {},
) {
  return new TableCell({
    borders,
    ...(options.fill ? { shading: { fill: options.fill } } : {}),
    children: [
      new Paragraph({
        alignment: options.align ?? AlignmentType.LEFT,
        spacing: { after: 0 },
        children: [
          new TextRun({
            text: String(text),
            font: FONT,
            bold: options.bold,
            size: options.size ?? 17,
          }),
        ],
      }),
    ],
  });
}

function headerCell(text: string, fill?: string) {
  return cell(text, { bold: true, align: AlignmentType.CENTER, fill, size: 16 });
}

function table(rows: TableRow[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    rows,
  });
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    result.set(groupKey, [...(result.get(groupKey) ?? []), row]);
  }
  return result;
}

function gradeFor(score: number) {
  if (score >= 75) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function mainHeader(departmentName: string) {
  return new Header({
    children: [
      p('IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES', {
        bold: true,
        size: 17,
        align: AlignmentType.CENTER,
        after: 30,
      }),
      p(departmentTitle(departmentName), {
        bold: true,
        size: 16,
        align: AlignmentType.CENTER,
        after: 30,
      }),
    ],
  });
}

function pageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Page ', font: FONT, size: 16 }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 }),
        ],
      }),
    ],
  });
}

function coverChildren(logo: Buffer, title: string, departmentName: string, departmentFirst: boolean) {
  const department = departmentTitle(departmentName);
  const lines = departmentFirst
    ? [department, title]
    : [title, department];

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new ImageRun({ data: logo, transformation: { width: 185, height: 139 }, type: 'png' })],
    }),
    p('IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES', {
      bold: true,
      size: 27,
      align: AlignmentType.CENTER,
      before: 280,
      after: 170,
    }),
    p(lines[0], { bold: true, size: 23, align: AlignmentType.CENTER, after: 170 }),
    p(lines[1], { bold: true, size: 24, align: AlignmentType.CENTER, after: 0 }),
  ];
}

function catParticipation(data: AssessmentPeriodReportData) {
  const cohorts = groupBy(data.rows, (row) => row.cohortName);
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['GROUP', 'TOTAL NO. OF STUDENTS', 'STUDENTS WHO SAT CAT', 'MISSED ALL CATS'].map((text) =>
        headerCell(text),
      ),
    }),
  ];

  let totalStudents = 0;
  let totalSat = 0;
  let totalMissedAll = 0;

  for (const [cohort, cohortRows] of [...cohorts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const students = groupBy(cohortRows, (row) => row.studentId);
    let sat = 0;
    let missedAll = 0;

    for (const studentRows of students.values()) {
      if (studentRows.some((row) => row.cat1 !== null)) sat += 1;
      else missedAll += 1;
    }

    totalStudents += students.size;
    totalSat += sat;
    totalMissedAll += missedAll;

    rows.push(
      new TableRow({
        children: [cell(cohort), cell(students.size), cell(sat), cell(missedAll)],
      }),
    );
  }

  rows.push(
    new TableRow({
      children: [
        cell('TOTAL', { bold: true }),
        cell(totalStudents, { bold: true }),
        cell(totalSat, { bold: true }),
        cell(totalMissedAll, { bold: true }),
      ],
    }),
  );

  return { node: table(rows), totalStudents, totalSat, totalMissedAll };
}

function catPerformance(data: AssessmentPeriodReportData) {
  const grouped = groupBy(
    data.rows,
    (row) => `${row.trainerName}|${row.unitId}|${row.cohortId}`,
  );

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['TRAINER', 'UNIT', 'COHORT/GROUP', 'SAT', 'MISSED', '≥8/15', '<8/15'].map((text) =>
        headerCell(text),
      ),
    }),
  ];

  const sorted = [...grouped.values()].sort((a, b) => {
    const aa = `${a[0]?.trainerName ?? ''}|${a[0]?.unitName ?? ''}|${a[0]?.cohortName ?? ''}`;
    const bb = `${b[0]?.trainerName ?? ''}|${b[0]?.unitName ?? ''}|${b[0]?.cohortName ?? ''}`;
    return aa.localeCompare(bb);
  });

  for (const items of sorted) {
    const first = items[0];
    const sat = items.filter((row) => row.cat1 !== null);
    rows.push(
      new TableRow({
        children: [
          cell(clean(first.trainerName)),
          cell(first.unitName),
          cell(first.cohortName),
          cell(sat.length),
          cell(items.length - sat.length),
          cell(sat.filter((row) => (row.cat1 ?? 0) >= 8).length),
          cell(sat.filter((row) => (row.cat1 ?? 0) < 8).length),
        ],
      }),
    );
  }

  return table(rows);
}

function catMissed(data: AssessmentPeriodReportData) {
  const missed = data.rows
    .filter((row) => row.cat1 === null)
    .sort((a, b) => `${a.fullName}|${a.unitName}`.localeCompare(`${b.fullName}|${b.unitName}`));

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['STUDENT NAME', 'ADMISSION NUMBER', 'UNIT MISSED', 'REASON', 'RECOMMENDATION'].map((text) =>
        headerCell(text),
      ),
    }),
  ];

  for (const row of missed) {
    rows.push(
      new TableRow({
        children: [
          cell(row.fullName),
          cell(row.admissionNumber),
          cell(row.unitName),
          cell(clean(row.catReason)),
          cell(clean(row.catRecommendation)),
        ],
      }),
    );
  }

  if (!missed.length) {
    rows.push(
      new TableRow({
        children: [cell('No missed CATs recorded.'), cell(''), cell(''), cell(''), cell('')],
      }),
    );
  }

  return { node: table(rows), count: missed.length };
}

export async function buildCatAnalysisDocx(data: AssessmentPeriodReportData) {
  const logo = await readFile(path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png'));
  const title = `${periodUpper(data.periodName)} CAT ANALYSIS REPORT`;
  const participation = catParticipation(data);
  const missed = catMissed(data);

  const doc = new Document({
    creator: data.departmentName,
    title,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20 },
          paragraph: { spacing: { after: 80 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: coverChildren(logo, title, data.departmentName, true),
      },
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 540, right: 540, bottom: 540, left: 540 },
          },
        },
        headers: { default: mainHeader(data.departmentName) },
        footers: { default: pageFooter() },
        children: [
          heading('GENERAL COMMENTS'),
          body(
            'The CATs were successfully conducted, with trainers efficiently marking the scripts within the designated time frame, ensuring that results were submitted on schedule.',
          ),
          heading('PURPOSE OF THE ANALYSIS'),
          body(
            'The purpose of this analysis is to evaluate the overall conduct and performance during the CAT period. By reviewing key factors such as attendance, student performance, and assessment integrity, we aim to gain insights into:',
          ),
          bullet("The effectiveness of the CATs in assessing students' abilities."),
          bullet('The general student preparedness and performance levels.'),
          bullet('The overall integrity and fairness of the assessment process.'),
          p('TABLE 1.0: CAT PARTICIPATION BY GROUP', { bold: true, size: 20, before: 140, after: 80 }),
          participation.node,
          p('TABLE 2.0: CAT PERFORMANCE ANALYSIS BY TRAINER, UNIT AND COHORT', {
            bold: true,
            size: 20,
            before: 160,
            after: 80,
          }),
          catPerformance(data),
          p('TABLE 3.0: STUDENTS WHO MISSED CATs', {
            bold: true,
            size: 20,
            before: 160,
            after: 80,
          }),
          missed.node,
          heading('CONCLUSION'),
          body(
            `The ${data.periodName} CATs were successfully conducted, marked and results submitted by the respective trainers. ` +
              `A total of ${participation.totalStudents} students were expected across the participating groups, with ${participation.totalSat} students sitting at least one CAT and ${participation.totalMissedAll} student(s) missing all CATs. ` +
              `${missed.count} missed CAT record(s) require departmental follow-up.`,
          ),
          heading('RECOMMENDATIONS'),
          bullet(
            'Students who missed CATs should undergo the disciplinary or departmental review process to establish the reasons for their absence before being cleared to undertake missed CATs.',
          ),
          bullet(
            'Students who performed below the pass mark should be encouraged to improve their preparation for subsequent assessments, while trainers continue monitoring their academic progress.',
          ),
          bullet(
            'The department should continue ensuring that CATs are conducted, marked and results submitted within the stipulated timelines.',
          ),
          p('Prepared by: ______________________________        Date: ______________________________', {
            size: 20,
            before: 260,
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function examParticipation(data: AssessmentPeriodReportData) {
  const cohorts = groupBy(data.rows, (row) => row.cohortName);
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['GROUP', 'NO. OF STUDENTS WHO SAT FOR EXAMS', 'NO. OF STUDENTS WHO MISSED EXAM'].map((text) =>
        headerCell(text, 'D9EFEA'),
      ),
    }),
  ];

  let satAll = 0;
  let missedSomeOrAll = 0;

  for (const [cohort, cohortRows] of [...cohorts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const students = groupBy(cohortRows, (row) => row.studentId);
    let sat = 0;
    let missed = 0;

    for (const studentRows of students.values()) {
      if (studentRows.some((row) => row.attendance === 'absent')) missed += 1;
      else sat += 1;
    }

    satAll += sat;
    missedSomeOrAll += missed;

    rows.push(new TableRow({ children: [cell(cohort), cell(sat), cell(missed)] }));
  }

  rows.push(
    new TableRow({
      children: [
        cell('TOTAL', { bold: true }),
        cell(satAll, { bold: true }),
        cell(missedSomeOrAll, { bold: true }),
      ],
    }),
  );

  return { node: table(rows), satAll, missedSomeOrAll };
}

function examPerformance(data: AssessmentPeriodReportData) {
  const grouped = groupBy(
    data.rows,
    (row) => `${row.trainerName}|${row.unitId}|${row.cohortId}`,
  );

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        'TRAINER',
        'UNIT NAME',
        'GROUP',
        'DID EXAM',
        'MISSED',
        'DISTINCTION (A)',
        'CREDIT (B)',
        'SATISFACTORY (C)',
        'PASS (D)',
        'FAIL (E)',
        'MEAN SCORE',
        'MEAN GRADE',
      ].map((text) => headerCell(text, 'D9EFEA')),
    }),
  ];

  const sorted = [...grouped.values()].sort((a, b) => {
    const aa = `${a[0]?.trainerName ?? ''}|${a[0]?.unitName ?? ''}|${a[0]?.cohortName ?? ''}`;
    const bb = `${b[0]?.trainerName ?? ''}|${b[0]?.unitName ?? ''}|${b[0]?.cohortName ?? ''}`;
    return aa.localeCompare(bb);
  });

  for (const items of sorted) {
    const first = items[0];
    const present = items.filter((row) => row.attendance !== 'absent');
    const totals = present
      .map((row) => row.total)
      .filter((value): value is number => typeof value === 'number');

    const mean = totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : null;

    rows.push(
      new TableRow({
        children: [
          cell(clean(first.trainerName)),
          cell(first.unitName),
          cell(first.cohortName),
          cell(present.length),
          cell(items.length - present.length),
          cell(totals.filter((value) => value >= 75).length),
          cell(totals.filter((value) => value >= 65 && value < 75).length),
          cell(totals.filter((value) => value >= 50 && value < 65).length),
          cell(totals.filter((value) => value >= 40 && value < 50).length),
          cell(totals.filter((value) => value < 40).length),
          cell(mean === null ? '—' : mean.toFixed(1)),
          cell(mean === null ? '—' : gradeFor(mean)),
        ],
      }),
    );
  }

  return table(rows);
}

function examMissedPerUnit(data: AssessmentPeriodReportData) {
  const missed = data.rows
    .filter((row) => row.attendance === 'absent')
    .sort((a, b) => `${a.fullName}|${a.unitName}`.localeCompare(`${b.fullName}|${b.unitName}`));

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['S/NO', 'STUDENT NAME', 'ADM. NO.', 'EXAMS MISSED', 'REASONS', 'RECOMMENDATIONS'].map((text) =>
        headerCell(text, 'D9EFEA'),
      ),
    }),
  ];

  missed.forEach((row, index) => {
    rows.push(
      new TableRow({
        children: [
          cell(index + 1),
          cell(row.fullName),
          cell(row.admissionNumber),
          cell(row.unitName),
          cell(clean(row.examReason)),
          cell(clean(row.examRecommendation)),
        ],
      }),
    );
  });

  if (!missed.length) {
    rows.push(
      new TableRow({
        children: [cell(''), cell('No missed examinations recorded.'), cell(''), cell(''), cell(''), cell('')],
      }),
    );
  }

  return { node: table(rows), count: missed.length };
}

function examMissedAll(data: AssessmentPeriodReportData) {
  const students = [...groupBy(data.rows, (row) => row.studentId).values()]
    .filter((rows) => rows.length > 0 && rows.every((row) => row.attendance === 'absent'))
    .sort((a, b) => a[0].fullName.localeCompare(b[0].fullName));

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['S/NO', 'NAME', 'ADM NO.', 'REASONS', 'WAY FORWARD'].map((text) =>
        headerCell(text, 'D9EFEA'),
      ),
    }),
  ];

  students.forEach((studentRows, index) => {
    const row = studentRows[0];
    rows.push(
      new TableRow({
        children: [
          cell(index + 1),
          cell(row.fullName),
          cell(row.admissionNumber),
          cell(clean(row.examReason)),
          cell(clean(row.examRecommendation)),
        ],
      }),
    );
  });

  if (!students.length) {
    rows.push(
      new TableRow({
        children: [cell(''), cell('No students missed all examinations.'), cell(''), cell(''), cell('')],
      }),
    );
  }

  return table(rows);
}

function failedStudents(data: AssessmentPeriodReportData) {
  const failed = data.rows
    .filter((row) => row.total !== null && row.total < 40)
    .sort((a, b) => `${a.fullName}|${a.unitName}`.localeCompare(`${b.fullName}|${b.unitName}`));

  // Count how many units each student failed in this academic period
  const failedCountsByStudent = new Map<string, number>();
  data.rows.forEach((row) => {
    if (row.total !== null && row.total < 40) {
      const count = failedCountsByStudent.get(row.admissionNumber) ?? 0;
      failedCountsByStudent.set(row.admissionNumber, count + 1);
    }
  });

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['S/NO', 'STUDENT NAME', 'ADMISSION NO.', 'EXAM FAILED', 'MARKS SCORED', 'RECOMMENDATIONS'].map(
        (text) => headerCell(text, 'D9EFEA'),
      ),
    }),
  ];

  failed.forEach((row, index) => {
    const studentFailCount = failedCountsByStudent.get(row.admissionNumber) ?? 0;
    const recommendation = studentFailCount > 3
      ? 'Academic counselling with biological parent involved'
      : 'Supplementary Exam';

    rows.push(
      new TableRow({
        children: [
          cell(index + 1),
          cell(row.fullName),
          cell(row.admissionNumber),
          cell(row.unitName),
          cell(row.total?.toFixed(1) ?? ''),
          cell(recommendation),
        ],
      }),
    );
  });

  if (!failed.length) {
    rows.push(
      new TableRow({
        children: [cell(''), cell('No failed examinations recorded.'), cell(''), cell(''), cell(''), cell('')],
      }),
    );
  }

  return { node: table(rows), count: failed.length };
}

export async function buildExamAnalysisDocx(data: AssessmentPeriodReportData) {
  const logo = await readFile(path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png'));
  const title = `${periodUpper(data.periodName)} EXAM ANALYSIS REPORT`;
  const participation = examParticipation(data);
  const missed = examMissedPerUnit(data);
  const failed = failedStudents(data);

  const doc = new Document({
    creator: data.departmentName,
    title,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20 },
          paragraph: { spacing: { after: 80 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: coverChildren(logo, title, data.departmentName, false),
      },
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 540, right: 540, bottom: 540, left: 540 },
          },
        },
        headers: { default: mainHeader(data.departmentName) },
        footers: { default: pageFooter() },
        children: [
          heading('GENERAL COMMENTS'),
          body(
            `The ${data.periodName} End Term Examinations were successfully conducted, with trainers efficiently marking the scripts within the designated time frame, ensuring that results were submitted on schedule.`,
          ),
          heading('PURPOSE OF THE ANALYSIS'),
          body(
            'The purpose of this analysis is to evaluate the overall conduct and performance during the Examination period. By reviewing key factors such as attendance, student performance, and exam integrity, we aim to gain insights into:',
          ),
          bullet("The effectiveness of the exam in assessing students' abilities."),
          bullet('The general student preparedness and performance levels.'),
          bullet('The overall integrity and fairness of the exam process.'),
          heading('SUMMARY'),
          body(
            `The Department had ${participation.satAll + participation.missedSomeOrAll} students on session during the ${data.periodName} semester. ` +
              `${participation.satAll} students sat all their examinations, while ${participation.missedSomeOrAll} student(s) missed one or more scheduled examinations. ` +
              `${failed.count} failed examination record(s) were identified for supplementary examination follow-up.`,
          ),
          p('NUMBER OF STUDENTS WHO DID EXAMS, MISSED AND WITH SUPPLEMENTARY IN VARIOUS UNITS', {
            bold: true,
            size: 20,
            before: 140,
            after: 80,
          }),
          participation.node,
          p('RESULT ANALYSIS PER UNIT PER TRAINER', {
            bold: true,
            size: 20,
            before: 160,
            after: 80,
          }),
          examPerformance(data),
          p(`STUDENTS WHO MISSED ${periodUpper(data.periodName)} END OF TERM EXAMINATIONS PER UNIT`, {
            bold: true,
            size: 20,
            before: 160,
            after: 80,
          }),
          missed.node,
          p(`STUDENTS WHO MISSED ALL EXAMINATIONS - ${periodUpper(data.periodName)}`, {
            bold: true,
            size: 20,
            before: 160,
            after: 80,
          }),
          examMissedAll(data),
          p(`STUDENTS WHO FAILED ${periodUpper(data.periodName)} END TERM EXAMINATIONS`, {
            bold: true,
            size: 20,
            before: 160,
            after: 80,
          }),
          failed.node,
          heading('CONCLUSION'),
          body(
            `The ${data.periodName} exam series recorded a high participation rate, with ${participation.satAll} students attending all their examinations and ${participation.missedSomeOrAll} student(s) missing one or more assessments. ` +
              `${failed.count} failed examination record(s) require supplementary examination follow-up. The results provide the department with an evidence-based basis for student follow-up and academic support.`,
          ),
          heading('RECOMMENDATIONS'),
          bullet(
            `The department should follow up with the ${participation.missedSomeOrAll} student(s) who missed examinations to establish the reasons and address any underlying challenges affecting full participation.`,
          ),
          bullet(
            'Trainers should provide targeted academic support for students who scored below average to improve their performance in future assessments.',
          ),
          bullet(
            'Continued emphasis on academic integrity and proper exam conduct is necessary, with regular reminders and sensitization sessions for students.',
          ),
          bullet(
            'The department should enhance communication and scheduling clarity before exams to ensure that all students are aware of their examination timelines and can attend every session without difficulty.',
          ),
          heading('PREPARED BY'),
          p(
            'Head of Department: ________________________________  Signature: ________________________  Date: _______________',
            { size: 19 },
          ),
          p(
            'Examination Officer: ________________________________  Signature: ________________________  Date: _______________',
            { size: 19, before: 80 },
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
