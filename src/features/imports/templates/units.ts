import {
  IMPORT_WORKSHEET_NAMES,
} from '../constants';
import {
  assertValidTemplateDefinition,
} from '../template-definition';

export const unitsImportTemplate =
  assertValidTemplateDefinition({
    key: 'hnd-units',
    entityType: 'units',
    version: '1.0',
    displayName: 'Units',
    instructionsWorksheetName:
      IMPORT_WORKSHEET_NAMES.instructions,
    dataWorksheetName:
      IMPORT_WORKSHEET_NAMES.data,
    metadataWorksheetName:
      IMPORT_WORKSHEET_NAMES.metadata,
    maximumRows: 10000,
    columns: [
      {
        key: 'programmeCode',
        header: 'Programme Code',
        required: true,
        description:
          'Code of the existing programme that owns the unit.',
        example: 'DHN',
        width: 20,
        cellType: 'text',
      },
      {
        key: 'code',
        header: 'Unit Code',
        required: true,
        description:
          'Official curriculum unit code.',
        example: 'NUT-101',
        width: 20,
        cellType: 'text',
      },
      {
        key: 'name',
        header: 'Unit Name',
        required: true,
        description:
          'Official full curriculum unit name.',
        example:
          'Introduction to Human Nutrition',
        width: 42,
        cellType: 'text',
      },
      {
        key: 'shortName',
        header: 'Short Name',
        required: false,
        description:
          'Optional abbreviated unit name.',
        example: 'Human Nutrition I',
        width: 26,
        cellType: 'text',
      },
      {
        key: 'category',
        header: 'Category',
        required: true,
        description:
          'Official curriculum-unit category.',
        example: 'core',
        acceptedValues: [
          'core',
          'common',
          'elective',
          'practical',
          'clinical',
          'project',
          'other',
        ],
        width: 18,
        cellType: 'enum',
      },
      {
        key: 'academicPeriodNumber',
        header: 'Academic Period Number',
        required: true,
        description:
          'Programme period in which the unit is normally taught.',
        example: 1,
        width: 25,
        cellType: 'integer',
        numberFormat: '0',
      },
      {
        key: 'theoryHours',
        header: 'Theory Hours',
        required: true,
        description:
          'Expected theory contact hours.',
        example: 30,
        width: 18,
        cellType: 'number',
        numberFormat: '0.0',
      },
      {
        key: 'practicalHours',
        header: 'Practical Hours',
        required: true,
        description:
          'Expected practical, laboratory or clinical contact hours.',
        example: 15,
        width: 20,
        cellType: 'number',
        numberFormat: '0.0',
      },
      {
        key: 'weeklySessions',
        header: 'Weekly Sessions',
        required: true,
        description:
          'Expected number of timetable sessions each week.',
        example: 3,
        width: 19,
        cellType: 'integer',
        numberFormat: '0',
      },
      {
        key: 'preferredRoomType',
        header: 'Preferred Room Type',
        required: false,
        description:
          'Optional preferred teaching-space category.',
        example: 'lecture_room',
        acceptedValues: [
          'lecture_room',
          'laboratory',
          'skills_room',
          'computer_lab',
          'kitchen',
          'conference_room',
          'other',
        ],
        width: 24,
        cellType: 'enum',
      },
      {
        key: 'timetableAvailable',
        header: 'Timetable Available',
        required: true,
        description:
          'Whether the unit should be available for timetable allocation.',
        example: 'Yes',
        acceptedValues: [
          'Yes',
          'No',
        ],
        width: 22,
        cellType: 'boolean',
      },
      {
        key: 'notes',
        header: 'Notes',
        required: false,
        description:
          'Optional curriculum or scheduling information.',
        example:
          'First-period foundational unit.',
        width: 38,
        cellType: 'text',
      },
    ],
  });