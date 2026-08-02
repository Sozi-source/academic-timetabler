import type {
  ImportTemplateDefinition,
} from '@/features/imports/types';

export const unitOfferingsImportTemplate = {
  key: 'unit-offerings-import',
  entityType: 'unit_offerings',
  version: '1.0',

  displayName:
    'Semester Units on Offer',

  instructionsWorksheetName:
    'Instructions',

  dataWorksheetName:
    'Units on Offer',

  metadataWorksheetName:
    '_metadata',

  maximumRows: 10000,

  instructions: [
    'Use one row for each unit offered to one cohort in the selected Academic Period.',
    'Programme Name must match the programme registered in the system.',
    'Unit matching uses Programme Name and Unit Name. Unit Code is optional and is used only to confirm or disambiguate a match.',
    'The cohort must belong to the selected programme.',
    'Use the same Shared Class Key for units that should be taught together at the same day and time.',
    'A Shared Class Key does not merge curriculum records. Every cohort retains its official programme-specific unit and code.',
    'Leave Shared Class Key blank when the class should be scheduled independently.',
    'Attachment, clinical rotation and examination rows must use No under Include in Timetable.',
    'Preferred Trainer and Preferred Room are optional. Their names or registered codes may be supplied.',
    'The importer validates every row and shows a preview before anything is committed.',
    'Existing manually reviewed exclusions are preserved unless overwrite is deliberately enabled during confirmation.',
    'Do not rename worksheet names, headings or hidden metadata.',
  ],

  columns: [
    {
      key: 'academicPeriod',
      header: 'Academic Period',
      required: true,
      width: 28,
      description:
        'Academic Period name or registered code.',
      example:
        'September\u2013December 2026',
    },
    {
      key: 'programmeName',
      header: 'Programme Name',
      required: true,
      width: 42,
      description:
        'Full registered programme name.',
      example:
        'Diploma in Nutrition and Dietetics',
    },
    {
      key: 'cohortName',
      header: 'Cohort Name',
      required: true,
      width: 30,
      description:
        'Registered cohort name or cohort code.',
      example:
        'DND September 2026',
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
        'Optional programme-specific unit code used for confirmation or disambiguation.',
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
        'Number of sessions required each week.',
      numberFormat: '0',
      example: 2,
    },
    {
      key:
        'sessionDurationMinutes',
      header:
        'Session Duration Minutes',
      required: true,
      width: 24,
      description:
        'Duration of one session. Use 15-minute increments.',
      numberFormat: '0',
      example: 120,
    },
    {
      key: 'timetableEnabled',
      header: 'Include in Timetable',
      required: true,
      width: 22,
      description:
        'Whether the unit should enter ordinary timetable generation.',
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
        'Semester offering status.',
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
      width: 28,
      description:
        'Use the same key across cohort rows that must be taught as one class.',
      example:
        'COMMUNICATION-SEP26',
    },
    {
      key: 'preferredTrainer',
      header: 'Preferred Trainer',
      required: false,
      width: 30,
      description:
        'Optional registered trainer full name or staff number.',
      example:
        'Jane Waithera',
    },
    {
      key: 'preferredRoom',
      header: 'Preferred Room',
      required: false,
      width: 24,
      description:
        'Optional registered room name or code.',
      example:
        'Lecture Room 2',
    },
    {
      key: 'notes',
      header: 'Notes',
      required: false,
      width: 42,
      description:
        'Optional semester-specific remarks.',
      example:
        'Shared with certificate group.',
    },
  ],
} satisfies ImportTemplateDefinition;