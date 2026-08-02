import {
  IMPORT_WORKSHEET_NAMES,
} from '../constants';
import {
  assertValidTemplateDefinition,
} from '../template-definition';

export const trainersImportTemplate =
  assertValidTemplateDefinition({
    key: 'hnd-trainers',
    entityType: 'trainers',
    version: '1.0',
    displayName: 'Trainers',
    instructionsWorksheetName:
      IMPORT_WORKSHEET_NAMES.instructions,
    dataWorksheetName:
      IMPORT_WORKSHEET_NAMES.data,
    metadataWorksheetName:
      IMPORT_WORKSHEET_NAMES.metadata,
    maximumRows: 5000,
    columns: [
      {
        key: 'staffNumber',
        header: 'Staff Number',
        required: true,
        description:
          'Official unique staff identifier.',
        example: 'TR-001',
        width: 18,
        cellType: 'text',
      },
      {
        key: 'fullName',
        header: 'Full Name',
        required: true,
        description:
          'Trainer official full name.',
        example: 'Jane Waithera',
        width: 28,
        cellType: 'text',
      },
      {
        key: 'email',
        header: 'Email',
        required: false,
        description:
          'Official or institutional email address.',
        example: 'jane@example.com',
        width: 30,
        cellType: 'text',
      },
      {
        key: 'phoneNumber',
        header: 'Phone Number',
        required: false,
        description:
          'Phone number including country code where possible.',
        example: '+254 712 345 678',
        width: 22,
        cellType: 'text',
      },
      {
        key: 'employmentType',
        header: 'Employment Type',
        required: true,
        description:
          'Select one accepted employment category.',
        example: 'full_time',
        acceptedValues: [
          'full_time',
          'part_time',
          'visiting',
          'contract',
          'other',
        ],
        width: 20,
        cellType: 'enum',
      },
      {
        key: 'specialization',
        header: 'Specialization',
        required: false,
        description:
          'Main teaching or professional specialization.',
        example:
          'Clinical Nutrition and Dietetics',
        width: 34,
        cellType: 'text',
      },
      {
        key: 'qualifications',
        header: 'Qualifications',
        required: false,
        description:
          'Highest and relevant professional qualifications.',
        example:
          'BSc Human Nutrition and Dietetics',
        width: 38,
        cellType: 'text',
      },
      {
        key: 'maximumWeeklyHours',
        header: 'Maximum Weekly Hours',
        required: true,
        description:
          'Maximum permitted weekly teaching load.',
        example: 24,
        width: 22,
        cellType: 'number',
        numberFormat: '0.0',
      },
      {
        key: 'maximumDailyHours',
        header: 'Maximum Daily Hours',
        required: true,
        description:
          'Maximum permitted teaching load in one day.',
        example: 6,
        width: 21,
        cellType: 'number',
        numberFormat: '0.0',
      },
      {
        key: 'timetableAvailable',
        header: 'Timetable Available',
        required: true,
        description:
          'Whether the trainer should be available for scheduling.',
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
          'Optional scheduling or administrative notes.',
        example:
          'Available for diploma units.',
        width: 36,
        cellType: 'text',
      },
    ],
  });