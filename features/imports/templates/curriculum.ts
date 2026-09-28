import { IMPORT_WORKSHEET_NAMES } from '../constants';
import { assertValidTemplateDefinition } from '../template-definition';

export const curriculumImportTemplate =
  assertValidTemplateDefinition({
    key: 'hnd-curriculum',
    entityType: 'curriculum',
    version: '1.0',
    displayName: 'Curriculum',
    instructionsWorksheetName: IMPORT_WORKSHEET_NAMES.instructions,
    dataWorksheetName: IMPORT_WORKSHEET_NAMES.data,
    metadataWorksheetName: IMPORT_WORKSHEET_NAMES.metadata,
    maximumRows: 10000,
    instructions: [
      'Use one row for each curriculum unit.',
      'Keep the four fixed headings exactly as provided.',
      'Programme Code must already exist in the system.',
      'Stage must use the approved YxSy format, for example Y1S1 or Y2S3.',
      'Unit Code is the primary key used to match legacy units already in the system.',
      'Unit Name is treated as the official curriculum name. Existing matched units are normalized to this name when the import is committed.',
      'Do not add cohort, intake, trainer or academic-period columns to this workbook.',
      'Save and upload only as Excel .xlsx. CSV is not supported.',
    ],
    columns: [
      {
        key: 'programmeCode',
        header: 'Programme Code',
        required: true,
        description: 'Existing programme code.',
        example: 'CND',
        width: 20,
        cellType: 'text',
      },
      {
        key: 'stage',
        header: 'Stage',
        required: true,
        description: 'Approved academic stage.',
        example: 'Y1S1',
        width: 16,
        cellType: 'text',
      },
      {
        key: 'code',
        header: 'Unit Code',
        required: true,
        description: 'Official curriculum unit code.',
        example: 'CND 1101',
        width: 20,
        cellType: 'text',
      },
      {
        key: 'name',
        header: 'Unit Name',
        required: true,
        description: 'Official curriculum unit name.',
        example: 'Human Anatomy and Physiology',
        width: 46,
        cellType: 'text',
      },
    ],
  });
