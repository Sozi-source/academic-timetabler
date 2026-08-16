import {
  IMPORT_WORKSHEET_NAMES,
} from '../constants';
import {
  assertValidTemplateDefinition,
} from '../template-definition';

export const cohortsImportTemplate =
  assertValidTemplateDefinition({
    key: 'institutional-cohorts',
    entityType: 'cohorts',
    version: '2.0',
    displayName: 'Cohorts',
    instructionsWorksheetName:
      IMPORT_WORKSHEET_NAMES.instructions,
    dataWorksheetName:
      IMPORT_WORKSHEET_NAMES.data,
    metadataWorksheetName:
      IMPORT_WORKSHEET_NAMES.metadata,
    maximumRows: 5000,
    instructions: [
      'Enter one cohort per row in the Data worksheet.',
      'Keep every fixed header in the original order. Optional cells may be blank.',
      'Programme Code, Cohort Name and Intake Date are the only required values.',
      'Leave Cohort Code blank to generate PROGRAMME-MONTH-YEAR automatically.',
      'The programme must already exist in the active department.',
      'Use the date format YYYY-MM-DD.',
      'Remove or replace the example row before upload.',
      'Save the completed workbook in .xlsx format.',
    ],
    columns: [
      {
        key: 'programmeCode',
        header: 'Programme Code',
        required: true,
        description:
          'Code of an existing programme in the active department.',
        example: 'DHN',
        width: 20,
        cellType: 'text',
      },
      {
        key: 'code',
        header: 'Cohort Code',
        required: false,
        description:
          'Optional unique code. Blank values are generated from programme and intake date.',
        example: 'DHN-SEP-2026',
        width: 22,
        cellType: 'text',
      },
      {
        key: 'name',
        header: 'Cohort Name',
        required: true,
        description:
          'Clear cohort or class name.',
        example: 'DHN September 2026',
        width: 30,
        cellType: 'text',
      },
      {
        key: 'intakeDate',
        header: 'Intake Date',
        required: true,
        description:
          'Official intake date in YYYY-MM-DD format.',
        example: '2026-09-01',
        width: 18,
        cellType: 'date',
        numberFormat: 'yyyy-mm-dd',
      },
      {
        key: 'actualSize',
        header: 'Actual Size',
        required: false,
        defaultValue: 0,
        description:
          'Current enrolled learners. Blank defaults to zero.',
        example: 35,
        width: 16,
        cellType: 'integer',
        numberFormat: '0',
      },
      {
        key: 'status',
        header: 'Status',
        required: false,
        defaultValue: 'planned',
        description:
          'Cohort lifecycle status. Use active when learners are enrolled.',
        example: 'active',
        acceptedValues: [
          'planned',
          'active',
          'completed',
          'suspended',
          'archived',
        ],
        width: 18,
        cellType: 'enum',
      },
      {
        key: 'notes',
        header: 'Notes',
        required: false,
        description:
          'Optional administrative or planning note.',
        example: '',
        width: 38,
        cellType: 'text',
      },
    ],
  });
