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
  getContiguousTopicSpan,
  normalizeCurriculumLearningOutcomes,
  normalizeWeeklySchedule,
} from './curriculum-content-normalizer';
import {
  parseActivitiesList,
  parseCourseOutlineApproaches,
  parseCourseOutlineSubtopics,
  parseResourcesList,
  parseSLOOutcomes,
  parseSubTopics,
  type TVETCourseOutlineData,
  type TVETSchemeOfWorkData,
  type TVETRecordOfWorkData,
} from './tvet-standards';

const FONT = 'Arial';
const PRIMARY_DARK = '0F172A';
const SECONDARY_DARK = '334155';
const LIGHT_BG = 'F1F5F9';
const ZEBRA_BG = 'F8FAFC';
const BORDER_COLOR = '94A3B8';
const HEADER_BORDER_COLOR = '0F172A';

const lightBorder = { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR } as const;
const tableBorders = { top: lightBorder, bottom: lightBorder, left: lightBorder, right: lightBorder } as const;
const headerBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: HEADER_BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: HEADER_BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 4, color: HEADER_BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 4, color: HEADER_BORDER_COLOR },
} as const;

function clean(value: string | null | undefined, fallback = '—') {
  const text = value?.trim();
  return text ? text : fallback;
}


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
        bold: options.bold,
        size: options.size ?? 18,
        color: options.color ?? PRIMARY_DARK,
      }),
    ],
  });
}

function sectionHeader(number: string, title: string) {
  return new Paragraph({
    spacing: { before: 180, after: 80, line: 280 },
    children: [
      new TextRun({
        text: `${number}. ${title.toUpperCase()}`,
        font: FONT,
        bold: true,
        size: 20,
        color: PRIMARY_DARK,
      }),
    ],
  });
}

function cell(
  content: string | Paragraph[],
  options: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    fill?: string;
    size?: number;
    color?: string;
    widthPct?: number;
    isHeader?: boolean;
    rowSpan?: number;
  } = {},
) {
  const paragraphs: Paragraph[] = Array.isArray(content)
    ? content
    : [
        new Paragraph({
          alignment: options.align ?? AlignmentType.LEFT,
          spacing: { before: 20, after: 20, line: 240 },
          children: [
            new TextRun({
              text: String(content),
              font: FONT,
              bold: options.bold || options.isHeader,
              size: options.size ?? (options.isHeader ? 16 : 16),
              color: options.color ?? (options.isHeader ? PRIMARY_DARK : '222222'),
            }),
          ],
        }),
      ];

  return new TableCell({
    borders: options.isHeader ? headerBorders : tableBorders,
    shading: { fill: options.fill ?? (options.isHeader ? 'E2E8F0' : 'FFFFFF') },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    width: options.widthPct ? { size: options.widthPct, type: WidthType.PERCENTAGE } : undefined,
    rowSpan: options.rowSpan,
    children: paragraphs,
  });
}

/**
 * Builds a standardised TVET Word document (.docx)
 */
export async function buildTVETDocumentDocx(
  type: 'course_outline' | 'scheme_of_work' | 'record_of_work',
  data: {
    courseOutline?: TVETCourseOutlineData;
    schemeOfWork?: TVETSchemeOfWorkData;
    recordOfWork?: TVETRecordOfWorkData;
  },
): Promise<Buffer> {
  const header = data.courseOutline?.header ?? data.schemeOfWork?.header ?? data.recordOfWork?.header;
  if (!header) {
    throw new Error('Document header details unavailable.');
  }

  const title =
    type === 'course_outline'
      ? 'COURSE OUTLINE'
      : type === 'scheme_of_work'
        ? 'SCHEME OF WORK'
        : 'RECORD OF WORK COVERED';

  const isLandscape = type === 'scheme_of_work' || type === 'record_of_work';

  const children: (Paragraph | Table)[] = [];

  // 1. Center College Crest / Logo
  try {
    const logoBuffer = await readFile(
      path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png'),
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 65, height: 65 },
            type: 'png',
          }),
        ],
      }),
    );
  } catch (err) {
    console.warn('Could not load college logo for docx export:', err);
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 30 },
      children: [
        new TextRun({
          text: header.institutionName.toUpperCase(),
          font: FONT,
          bold: true,
          size: 24,
          color: PRIMARY_DARK,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: `DEPARTMENT OF ${header.departmentName.toUpperCase()}`,
          font: FONT,
          bold: true,
          size: 18,
          color: '555555',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: title,
          font: FONT,
          bold: true,
          size: 22,
          color: PRIMARY_DARK,
        }),
      ],
    }),
  );

  // 2. Conspicuous Unit Name Banner
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: headerBorders,
              shading: { fill: LIGHT_BG },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 20 },
                  children: [
                    new TextRun({
                      text: 'CURRICULUM UNIT',
                      font: FONT,
                      bold: true,
                      size: 14,
                      color: PRIMARY_DARK,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text:
                        type === 'course_outline'
                          ? header.unitName.toUpperCase()
                          : `${header.unitCode} — ${header.unitName.toUpperCase()}`,
                      font: FONT,
                      bold: true,
                      size: 22,
                      color: PRIMARY_DARK,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    p('', { after: 80 }),
  );

  // 3. Metadata Context Matrix Table
  const metadataFirstCell =
    type === 'course_outline'
      ? cell(`Unit: ${clean(header.unitName)}`, { bold: true, size: 15, widthPct: 25 })
      : cell(`Cohort: ${clean(header.cohortName)}`, { bold: true, size: 15, widthPct: 25 });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: [
            metadataFirstCell,
            cell(`Trainer: ${clean(header.trainerName)}`, { bold: true, size: 15, widthPct: 25 }),
            cell(`Academic Period: ${clean(header.academicPeriodName)}`, { bold: true, size: 15, widthPct: 25 }),
            cell(`Status: APPROVED`, { bold: true, size: 15, color: '1A7F37', widthPct: 25 }),
          ],
        }),
        new TableRow({
          children: [
            cell(`Weekly Hours: ${header.weeklyHours} hrs/wk`, { size: 15, widthPct: 25 }),
            cell(`Total Nominal: ${header.totalNominalHours} hrs`, { size: 15, widthPct: 25 }),
            cell(`Duration: 14 Weeks`, { size: 15, widthPct: 25 }),
            cell(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { size: 15, widthPct: 25 }),
          ],
        }),
      ],
    }),
    p('', { after: 120 }),
  );

  // 4. Content by Type
  if (type === 'course_outline' && data.courseOutline) {
    const co = data.courseOutline;

    // Section 1: Unit Description
    children.push(
      sectionHeader('1', 'Unit Description & Overall Purpose'),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 0, after: 120, line: 260 },
        children: [new TextRun({ text: clean(co.unitDescription), font: FONT, size: 18 })],
      }),
    );

    // Section 2: Summary of Learning Outcomes
    children.push(sectionHeader('2', 'Summary of Learning Outcomes (Core Competencies)'));
    const learningOutcomes = normalizeCurriculumLearningOutcomes(co.learningOutcomes);
    learningOutcomes.forEach((lo, i) => {
      children.push(
        new Paragraph({
          spacing: { before: 20, after: 40, line: 240 },
          children: [
            new TextRun({ text: `${i + 1}.  `, font: FONT, bold: true, color: PRIMARY_DARK, size: 18 }),
            new TextRun({ text: lo, font: FONT, size: 18 }),
          ],
        }),
      );
    });

    // Section 3: 14-Week Topical Breakdown Table
    // Keep weekly records intact, but normalize legacy content before rendering.
    const courseOutlineSchedule = normalizeWeeklySchedule(co.weeklySchedule);
    if (courseOutlineSchedule.length === 0) {
      children.push(
        p('NOTICE: Curriculum content for this unit is currently pending official TVET syllabus ingestion. Course outline topics and weekly schedules have not yet been published by the department.', {
          bold: true,
          color: '996600',
          before: 80,
          after: 120,
        }),
      );
    } else {
      children.push(
        sectionHeader('3', 'Weekly Delivery & Topical Breakdown'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              children: [
                cell('Week', { isHeader: true, align: AlignmentType.CENTER, widthPct: 8 }),
                cell('Topic Title', { isHeader: true, widthPct: 32 }),
                cell('Content / Sub-topics to be Covered', { isHeader: true, widthPct: 52 }),
                cell('Hours', { isHeader: true, align: AlignmentType.CENTER, widthPct: 8 }),
              ],
            }),
            ...courseOutlineSchedule.map((sched, idx) => {
              const fill = idx % 2 === 1 ? ZEBRA_BG : 'FFFFFF';
              const subList = parseCourseOutlineSubtopics(sched.subTopics);
              const topicSpan = getContiguousTopicSpan(courseOutlineSchedule, idx);
              const subParagraphs: Paragraph[] =
                subList.length > 0
                  ? subList.map(
                      (s) =>
                        new Paragraph({
                          alignment: AlignmentType.LEFT,
                          spacing: { before: 8, after: 8, line: 220 },
                          indent: { left: 140 },
                          children: [
                            new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
                            new TextRun({ text: clean(s), font: FONT, size: 14, color: '222222' }),
                          ],
                        }),
                    )
                  : [
                      new Paragraph({
                        alignment: AlignmentType.LEFT,
                        spacing: { before: 8, after: 8, line: 220 },
                        children: [
                          new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
                          new TextRun({ text: 'Core topic coverage and practical mastery', font: FONT, size: 14, color: '555555' }),
                        ],
                      }),
                    ];

              const rowCells = [
                cell(`W${sched.weekNumber}`, { align: AlignmentType.CENTER, bold: true, color: PRIMARY_DARK, fill, widthPct: 8 }),
                ...(topicSpan.isStart
                  ? [cell(sched.topicTitle, { bold: true, fill: 'FFFFFF', widthPct: 32, rowSpan: topicSpan.rowSpan })]
                  : []),
                cell(subParagraphs, { fill, widthPct: 52 }),
                cell(`${sched.hours} hrs`, { align: AlignmentType.CENTER, fill, widthPct: 8 }),
              ];

              return new TableRow({ children: rowCells });
            }),
          ],
        }),
        p('', { after: 100 }),
      );
    }

    // Section 4: Approaches (Only bullets, each on a new line)
    const rawTeaching =
      co.teachingLearningApproaches?.trim() ||
      'Interactive lectures and illustrated tutorials, Guided classroom discussions and seminar presentations, Practical laboratory demonstrations and hands-on exercises, Small-group problem-solving and case studies, Supervised assignments and self-directed study';

    const teachingItems = parseCourseOutlineApproaches(rawTeaching);
    const teachingParagraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 20, after: 40, line: 240 },
        children: [
          new TextRun({ text: 'Teaching / Learning Approaches:', font: FONT, bold: true, size: 15, color: PRIMARY_DARK }),
        ],
      }),
      ...teachingItems.map(
        (item) =>
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 8, after: 8, line: 220 },
            indent: { left: 140 },
            children: [
              new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
              new TextRun({ text: clean(item), font: FONT, size: 14, color: '222222' }),
            ],
          }),
      ),
    ];

    const rawAssessment =
      co.assessmentApproaches?.trim() ||
      'Continuous Assessment Tests (CATs) — 30%\nPractical Assignments, Laboratory Reports & Logbooks — 20%\nEnd-of-Term Summative Examination — 50%';

    const assessmentItems = parseCourseOutlineApproaches(rawAssessment);
    const assessmentParagraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 20, after: 40, line: 240 },
        children: [
          new TextRun({ text: 'Assessment Weighting & Evaluation:', font: FONT, bold: true, size: 15, color: PRIMARY_DARK }),
        ],
      }),
      ...assessmentItems.map(
        (item) =>
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 8, after: 8, line: 220 },
            indent: { left: 140 },
            children: [
              new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
              new TextRun({ text: clean(item), font: FONT, size: 14, color: '222222' }),
            ],
          }),
      ),
    ];

    children.push(
      sectionHeader('4', 'Teaching / Learning & Assessment Approaches'),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            children: [
              cell(teachingParagraphs, { fill: ZEBRA_BG, widthPct: 50 }),
              cell(assessmentParagraphs, { fill: ZEBRA_BG, widthPct: 50 }),
            ],
          }),
        ],
      }),
      p('', { after: 100 }),
    );

    // Section 5: References & Equipment (Only bullets, each on a new line)
    const refItems =
      co.references && co.references.length > 0
        ? co.references.map((r) => r.replace(/^[\s\d.)(\]\[•·▪●◦\-–—]+/, '').trim()).filter(Boolean)
        : ['Prescribed curriculum textbooks, clinical manuals, and official departmental handouts.'];

    const referenceParagraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 20, after: 40, line: 240 },
        children: [
          new TextRun({ text: 'Prescribed References & Textbooks:', font: FONT, bold: true, size: 15, color: PRIMARY_DARK }),
        ],
      }),
      ...refItems.map(
        (r) =>
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 8, after: 8, line: 220 },
            indent: { left: 140 },
            children: [
              new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
              new TextRun({ text: clean(r), font: FONT, size: 14, color: '222222' }),
            ],
          }),
      ),
    ];

    const rawEquip =
      co.instructionalEquipment && co.instructionalEquipment.length > 0
        ? co.instructionalEquipment.join(', ')
        : 'Whiteboard & dry-erase markers, Multimedia LCD projector and computer aids, Personal protective equipment (PPE) and clinical laboratory gear, Standard TVET training manuals and reference charts';

    const equipItems = parseCourseOutlineApproaches(rawEquip);
    const equipParagraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 20, after: 40, line: 240 },
        children: [
          new TextRun({ text: 'Instructional Equipment & Safety Materials:', font: FONT, bold: true, size: 15, color: PRIMARY_DARK }),
        ],
      }),
      ...equipItems.map(
        (e) =>
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 8, after: 8, line: 220 },
            indent: { left: 140 },
            children: [
              new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
              new TextRun({ text: clean(e), font: FONT, size: 14, color: '222222' }),
            ],
          }),
      ),
    ];

    children.push(
      sectionHeader('5', 'Instructional Resources & References'),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            children: [
              cell(referenceParagraphs, { fill: ZEBRA_BG, widthPct: 50 }),
              cell(equipParagraphs, { fill: ZEBRA_BG, widthPct: 50 }),
            ],
          }),
        ],
      }),
      p('', { after: 120 }),
    );
  }

  if (type === 'scheme_of_work' && data.schemeOfWork) {
    const sow = data.schemeOfWork;

    if (sow.plannedWeeks.length === 0) {
      children.push(
        p('NOTICE: Curriculum content for this unit is currently pending official TVET syllabus ingestion. The 14-week scheme of work has not yet been published by the department.', {
          bold: true,
          color: '996600',
          before: 80,
          after: 120,
        }),
      );
    } else {
      // 14-Week Balanced Table
      children.push(
        new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            children: [
              cell('Wk', { isHeader: true, align: AlignmentType.CENTER, widthPct: 4 }),
              cell('Topic & Sub-topics', { isHeader: true, widthPct: 20 }),
              cell('Specific Learning Outcomes (SLOs)', { isHeader: true, widthPct: 28 }),
              cell('Activities & Methodology', { isHeader: true, widthPct: 16 }),
              cell('Instructional Resources', { isHeader: true, widthPct: 18 }),
              cell('Assessment & Remarks', { isHeader: true, widthPct: 14 }),
            ],
          }),
          ...sow.plannedWeeks.map((w, idx) => {
            const fill = idx % 2 === 1 ? ZEBRA_BG : 'FFFFFF';
            const subtopics = parseSubTopics(w.subTopics);
            const isMilestone =
              Boolean(w.assessmentAndRemarks) &&
              (w.assessmentAndRemarks.toLowerCase().includes('cat') ||
                w.assessmentAndRemarks.toLowerCase().includes('exam'));

            // 1. Topic & Subtopics (each subtopic on new line using bullet)
            const topicChildren: Paragraph[] = [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 20, after: subtopics.length > 0 ? 30 : 20, line: 240 },
                children: [
                  new TextRun({ text: clean(w.topic), font: FONT, bold: true, size: 15, color: PRIMARY_DARK }),
                ],
              }),
              ...subtopics.map((st) =>
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 10, after: 10, line: 220 },
                  indent: { left: 140 },
                  children: [
                    new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
                    new TextRun({ text: clean(st), font: FONT, size: 14, color: '333333' }),
                  ],
                }),
              ),
            ];

            // 2. Specific Learning Outcomes: start with "By the end of the lesson/topic, the trainee should be able to:" (bold), then each outcome on its line
            const sloOutcomes = parseSLOOutcomes(w.specificLearningOutcomes);

            const sloChildren: Paragraph[] = sloOutcomes.length > 0
              ? [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 20, after: 20, line: 240 },
                    children: [
                      new TextRun({
                        text: 'By the end of the lesson/topic, the trainee should be able to:',
                        font: FONT,
                        bold: true,
                        size: 14,
                        color: PRIMARY_DARK,
                      }),
                    ],
                  }),
                  ...sloOutcomes.map((lo) =>
                    new Paragraph({
                      alignment: AlignmentType.LEFT,
                      spacing: { before: 10, after: 10, line: 220 },
                      indent: { left: 140 },
                      children: [
                        new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
                        new TextRun({ text: clean(lo), font: FONT, size: 14, color: '333333' }),
                      ],
                    }),
                  ),
                ]
              : [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 20, after: 20, line: 240 },
                    children: [new TextRun({ text: '—', font: FONT, size: 14, color: '777777' })],
                  }),
                ];

            // 3. Activities: each activity on a new line
            const activities = parseActivitiesList(w.learningActivities);
            const activityChildren: Paragraph[] = activities.length > 0
              ? activities.map((act) =>
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 10, after: 10, line: 220 },
                    indent: { left: 140 },
                    children: [
                      new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
                      new TextRun({ text: clean(act), font: FONT, size: 14, color: '333333' }),
                    ],
                  }),
                )
              : [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 20, after: 20, line: 240 },
                    children: [new TextRun({ text: '—', font: FONT, size: 14, color: '777777' })],
                  }),
                ];

            // 4. Resources: each resource on a new line, widened column (18%)
            const resources = parseResourcesList(w.resourcesAndReferences);
            const resourceChildren: Paragraph[] = resources.length > 0
              ? resources.map((res) =>
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 10, after: 10, line: 220 },
                    indent: { left: 140 },
                    children: [
                      new TextRun({ text: '•  ', font: FONT, bold: true, size: 14, color: PRIMARY_DARK }),
                      new TextRun({ text: clean(res), font: FONT, size: 14, color: '333333' }),
                    ],
                  }),
                )
              : [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 20, after: 20, line: 240 },
                    children: [new TextRun({ text: '—', font: FONT, size: 14, color: '777777' })],
                  }),
                ];

            // 5. Assessment & Remarks: with scheduled college date
            const remarkParts = (w.assessmentAndRemarks || '—').split('\n');
            const mainRemark = remarkParts[0];
            const datePart = remarkParts.find((p) => p.includes('Date:'));

            const remarkChildren: Paragraph[] = [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 20, after: datePart ? 10 : 20, line: 240 },
                children: [
                  new TextRun({
                    text: clean(mainRemark),
                    font: FONT,
                    bold: isMilestone,
                    size: 14,
                    color: isMilestone ? PRIMARY_DARK : '333333',
                  }),
                ],
              }),
              ...(datePart
                ? [
                    new Paragraph({
                      alignment: AlignmentType.LEFT,
                      spacing: { before: 10, after: 20, line: 220 },
                      children: [
                        new TextRun({
                          text: clean(datePart),
                          font: FONT,
                          bold: true,
                          size: 13,
                          color: 'B45309',
                        }),
                      ],
                    }),
                  ]
                : []),
            ];

            return new TableRow({
              children: [
                cell(String(w.weekNumber), { align: AlignmentType.CENTER, bold: true, color: PRIMARY_DARK, fill, widthPct: 4 }),
                cell(topicChildren, { fill, widthPct: 20 }),
                cell(sloChildren, { fill, widthPct: 28 }),
                cell(activityChildren, { fill, widthPct: 16 }),
                cell(resourceChildren, { fill, widthPct: 18 }),
                cell(remarkChildren, { fill, widthPct: 14 }),
              ],
            });
          }),
        ],
      }),
      p('', { after: 120 }),
    );
    }
  }

  // 5. Sign-off Blocks
  children.push(
    p('', { before: 120 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: [
            cell(
              [
                p('TRAINER SIGN-OFF', { bold: true, size: 14, color: PRIMARY_DARK }),
                p(`\n\n_______________________\n${header.trainerName}\nDate: _______________`, { size: 14 }),
              ],
              { widthPct: 33 },
            ),
            cell(
              [
                p('HEAD OF DEPARTMENT (HOD)', { bold: true, size: 14, color: PRIMARY_DARK }),
                p(`\n\n_______________________\nSignature & Stamp\nDate: _______________`, { size: 14 }),
              ],
              { widthPct: 33 },
            ),
            cell(
              [
                p('QUALITY ASSURANCE VERIFICATION', { bold: true, size: 14, color: PRIMARY_DARK }),
                p(`\n\n_______________________\nAudit Verification\nDate: _______________`, { size: 14 }),
              ],
              { widthPct: 34 },
            ),
          ],
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: isLandscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: `${header.unitCode} · ${header.unitName} — ${title}`,
                    font: FONT,
                    size: 14,
                    color: '888888',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 40 },
                children: [
                  new TextRun({ text: 'Page ', font: FONT, size: 14, color: '888888' }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: '888888' }),
                  new TextRun({ text: ' of ', font: FONT, size: 14, color: '888888' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: '888888' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
