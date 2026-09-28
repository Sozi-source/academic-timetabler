import ExcelJS from 'exceljs';

export interface CurriculumLibraryWorkbookRecordV54 {
  documentType:
    | 'course_outline'
    | 'scheme_of_work';
  versionNumber: number;
  payload: any;
}

function text(
  value: unknown,
) {
  return String(
    value ?? '',
  ).trim();
}

export async function buildCurriculumLibraryWorkbookV54(
  record:
    CurriculumLibraryWorkbookRecordV54,
) {
  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    'Academic Planner';

  const unit =
    record.payload?.unit ?? {};

  const content = Array.isArray(
    record.payload?.content,
  )
    ? record.payload.content
    : [];

  const unitCode =
    text(unit.unitCode);

  const unitName =
    text(unit.unitName);

  const units =
    workbook.addWorksheet(
      'Units',
    );

  const unitHeaders = [
    'unit_code',
    'unit_name',
    'document_type',
    'content_family_key',
    'curriculum_version',
    'unit_description',
    'core_learning_outcomes',
    'teaching_learning_approaches',
    'assessment_approaches',
    'references_resources',
  ];

  units.addRow(
    unitHeaders,
  );

  units.addRow([
    unitCode,
    unitName,
    record.documentType,
    text(
      unit.contentFamilyKey,
    ),
    Number(
      unit.curriculumVersion ??
        record.versionNumber,
    ),
    text(
      unit.unitDescription,
    ),
    text(
      unit.coreLearningOutcomes,
    ),
    text(
      unit.teachingLearningApproaches,
    ),
    text(
      unit.assessmentApproaches,
    ),
    text(
      unit.referencesResources,
    ),
  ]);

  const contentSheet =
    workbook.addWorksheet(
      'Content',
    );

  const headers =
    record.documentType ===
    'course_outline'
      ? [
          'unit_code',
          'unit_name',
          'sequence',
          'topic',
          'coverage',
        ]
      : [
          'unit_code',
          'unit_name',
          'sequence',
          'topic',
          'coverage',
          'learning_outcomes',
          'activities',
          'assessment',
          'resources',
        ];

  contentSheet.addRow(
    headers,
  );

  for (
    const item of content
  ) {
    const base = [
      unitCode,
      unitName,
      Number(
        item.sequence ?? 0,
      ),
      text(item.topic),
      text(item.coverage),
    ];

    if (
      record.documentType ===
      'course_outline'
    ) {
      contentSheet.addRow(
        base,
      );
    } else {
      contentSheet.addRow([
        ...base,
        text(
          item.learningOutcomes,
        ),
        text(
          item.activities,
        ),
        text(
          item.assessment,
        ),
        text(
          item.resources,
        ),
      ]);
    }
  }

  for (
    const sheet of [
      units,
      contentSheet,
    ]
  ) {
    const header =
      sheet.getRow(1);

    header.font = {
      bold: true,
      color: {
        argb:
          'FFFFFFFF',
      },
    };

    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb:
          'FF17365D',
      },
    };

    header.alignment = {
      vertical:
        'middle',
      horizontal:
        'center',
      wrapText: true,
    };

    sheet.views = [
      {
        state:
          'frozen',
        ySplit: 1,
      },
    ];

    sheet.columns.forEach(
      (column) => {
        column.width = 24;
      },
    );
  }

  contentSheet.getColumn(
    'D',
  ).width = 45;

  contentSheet.getColumn(
    'E',
  ).width = 70;

  return Buffer.from(
    await workbook.xlsx.writeBuffer(),
  );
}
