import {
  IMPORT_WORKSHEET_NAMES,
} from '../constants';
import {
  assertValidTemplateDefinition,
} from '../template-definition';

export const programmesImportTemplate =
  assertValidTemplateDefinition({
    key: 'hnd-programmes',
    entityType: 'programmes',
    version: '1.0',
    displayName: 'Programmes',
    instructionsWorksheetName:
      IMPORT_WORKSHEET_NAMES.instructions,
    dataWorksheetName:
      IMPORT_WORKSHEET_NAMES.data,
    metadataWorksheetName:
      IMPORT_WORKSHEET_NAMES.metadata,
    maximumRows: 2000,
    columns: [
      {
        key: 'code',
        header: 'Programme Code',
        required: true,
        description:
          'Official unique programme code.',
        example: 'DHN',
        width: 20,
        cellType: 'text',
      },
      {
        key: 'name',
        header: 'Programme Name',
        required: true,
        description:
          'Official full programme name.',
        example:
          'Diploma in Human Nutrition and Dietetics',
        width: 45,
        cellType: 'text',
      },
      {
        key: 'shortName',
        header: 'Short Name',
        required: false,
        description:
          'Optional abbreviated programme name.',
        example: 'Diploma HND',
        width: 22,
        cellType: 'text',
      },
      {
        key: 'awardLevel',
        header: 'Award Level',
        required: true,
        description:
          'Select the official programme award level.',
        example: 'diploma',
        acceptedValues: [
          'certificate',
          'craft_certificate',
          'artisan_certificate',
          'diploma',
          'higher_diploma',
          'degree',
          'short_course',
          'other',
        ],
        width: 22,
        cellType: 'enum',
      },
      {
        key: 'awardingBody',
        header: 'Awarding Body',
        required: false,
        description:
          'Examining, regulatory or awarding body.',
        example: 'TVET CDACC',
        width: 25,
        cellType: 'text',
      },
      {
        key: 'durationValue',
        header: 'Duration Value',
        required: true,
        description:
          'Numeric programme duration.',
        example: 3,
        width: 18,
        cellType: 'number',
        numberFormat: '0.0',
      },
      {
        key: 'durationUnit',
        header: 'Duration Unit',
        required: true,
        description:
          'Whether the duration is expressed in months or years.',
        example: 'years',
        acceptedValues: [
          'months',
          'years',
        ],
        width: 18,
        cellType: 'enum',
      },
      {
        key: 'totalAcademicPeriods',
        header: 'Total Academic Periods',
        required: true,
        description:
          'Total terms, semesters or configured periods required.',
        example: 9,
        width: 24,
        cellType: 'integer',
        numberFormat: '0',
      },
      {
        key: 'maximumCohortSize',
        header: 'Maximum Cohort Size',
        required: false,
        description:
          'Optional planning limit for one cohort.',
        example: 50,
        width: 23,
        cellType: 'integer',
        numberFormat: '0',
      },
      {
        key: 'timetableAvailable',
        header: 'Timetable Available',
        required: true,
        description:
          'Whether the programme should be available for scheduling.',
        example: 'Yes',
        acceptedValues: [
          'Yes',
          'No',
        ],
        width: 21,
        cellType: 'boolean',
      },
      {
        key: 'notes',
        header: 'Notes',
        required: false,
        description:
          'Optional accreditation or planning information.',
        example:
          'Three-year institutional diploma.',
        width: 38,
        cellType: 'text',
      },
    ],
  });