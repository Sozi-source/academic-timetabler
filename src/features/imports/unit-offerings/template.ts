import type {
  ImportTemplateDefinition,
} from '@/features/imports/types';

export const unitOfferingsImportTemplate = {
  key: 'unit-offerings-import',
  entityType: 'unit_offerings',
  version: '1.1',

  displayName:
    'Units on Offer',

  instructionsWorksheetName:
    'Instructions',

  dataWorksheetName:
    'Units on Offer',

  metadataWorksheetName:
    '_metadata',

  maximumRows: 10000,

  instructions: [
    'Use one row for each unit offered to one cohort in the selected Academic Period.',
    'Use the exact Academic Period, Programme and Cohort names or codes registered in the system.',
    'Unit matching uses the programme and unit. Unit Code confirms or disambiguates the match.',
    'The cohort must belong to the selected programme.',
    'For a shared unit, enter one row for every participating cohort.',
    'Leave Shared Class Key blank when the unit name, Offering Type, Weekly Sessions and Session Duration match. The system will combine those rows automatically.',
    'Use the same custom Shared Class Key only when you need to force rows into one shared class.',
    'Enter INDEPENDENT when a unit must remain separate.',
    'Shared teaching does not merge curriculum records. Every cohort retains its official unit and programme-specific unit code.',
    'Attachment, clinical rotation and examination rows should use No under Include in Timetable.',
    'Preferred Trainer and Preferred Room are optional.',
    'Review all staged rows before confirming the import.',
    'Do not rename worksheets, headings or the hidden metadata sheet.',
  ],

  columns: [
    {
      key: 'academicPeriod',
      header: 'Academic Period',
      required: true,
      width: 30,
      description:
        'Exact registered Academic Period name or code.',
      example:
        'September-December 2026',
    },
    {
      key: 'programmeName',
      header: 'Programme Name',
      required: true,
      width: 42,
      description:
        'Exact registered programme name or programme code.',
      example:
        'Diploma in Nutrition and Dietetics',
    },
    {
      key: 'cohortName',
      header: 'Cohort Name',
      required: true,
      width: 30,
      description:
        'Exact registered cohort name or cohort code.',
      example:
        'DND SEPT 26',
    },
    {
      key: 'unitName',
      header: 'Unit Name',
      required: true,
      width: 38,
      description:
        'Official unit name within the selected programme.',
      example:
        'Communication Skills',
    },
    {
      key: 'unitCode',
      header: 'Unit Code',
      required: false,
      width: 18,
      description:
        'Programme-specific unit code.',
      example:
        'DND 105',
    },
    {
      key: 'offeringType',
      header: 'Offering Type',
      required: true,
      width: 22,
      description:
        'Academic delivery context.',
      acceptedValues: [
        'classroom',
        'practical',
        'clinical_rotation',
        'attachment',
        'project',
        'examination',
        'other',
      ],
      example:
        'classroom',
    },
    {
      key: 'weeklySessions',
      header: 'Weekly Sessions',
      required: true,
      width: 18,
      description:
        'Number of sessions each week. A 2-hour unit uses 1 session; a 4-hour unit normally uses 2 sessions.',
      cellType: 'integer',
      numberFormat: '0',
      example: 1,
    },
    {
      key:
        'sessionDurationMinutes',
      header:
        'Session Duration Minutes',
      required: true,
      width: 24,
      description:
        'Duration of one session in minutes.',
      cellType: 'integer',
      numberFormat: '0',
      example: 120,
    },
    {
      key: 'timetableEnabled',
      header: 'Include in Timetable',
      required: true,
      width: 22,
      description:
        'Whether the unit enters ordinary timetable generation.',
      acceptedValues: [
        'Yes',
        'No',
      ],
      example: 'Yes',
    },
    {
      key: 'status',
      header: 'Status',
      required: true,
      width: 16,
      description:
        'Units on Offer status.',
      acceptedValues: [
        'draft',
        'active',
        'completed',
        'cancelled',
      ],
      example: 'draft',
    },
    {
      key: 'sharedClassKey',
      header: 'Shared Class Key',
      required: false,
      width: 32,
      description:
        'Leave blank for automatic shared-unit detection. Use the same custom value to force sharing, or INDEPENDENT to prevent sharing.',
      example:
        '',
    },
    {
      key: 'preferredTrainer',
      header: 'Preferred Trainer',
      required: false,
      width: 28,
      description:
        'Optional registered trainer name or staff number.',
      example:
        '',
    },
    {
      key: 'preferredRoom',
      header: 'Preferred Room',
      required: false,
      width: 24,
      description:
        'Optional registered room name or room code.',
      example:
        '',
    },
    {
      key: 'notes',
      header: 'Notes',
      required: false,
      width: 38,
      description:
        'Optional short note.',
      example:
        '',
    },
  ],
} satisfies ImportTemplateDefinition;
