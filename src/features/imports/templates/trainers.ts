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
    version: '2.2',
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
        key: 'departmentCode',
        header: 'School / Department Code',
        required: true,
        description:
          'Exact code of the trainer home school / department as registered in the system.',
        example: 'HND',
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
        required: false,
        defaultValue: 'full_time',
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
        key: 'workloadRole',
        header: 'Workload Role',
        required: false,
        description:
          'Workload category. Change this for HODs, coordinators, part-time or external trainers.',
        example: 'full_time_trainer',
        acceptedValues: [
          'hod',
          'course_coordinator',
          'full_time_trainer',
          'part_time',
          'external',
        ],
        width: 23,
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
        key: 'normalWeeklyHours',
        header: 'Normal Weekly Hours',
        required: false,
        description:
          'Weekly target before extra hours begin. HOD, coordinator and full-time targets are standardized to 10, 16 and 20 hours.',
        example: 20,
        width: 22,
        cellType: 'number',
        numberFormat: '0.0',
      },
      {
        key: 'maximumWeeklyHours',
        header: 'Maximum Weekly Hours',
        required: false,
        description:
          'Legacy compatibility field. Leave blank; weekly extra hours are allowed.',
        example: '',
        width: 22,
        cellType: 'number',
        numberFormat: '0.0',
      },
      {
        key: 'maximumDailyHours',
        header: 'Maximum Daily Hours',
        required: false,
        defaultValue: 6,
        description:
          'Hard scheduling limit for teaching in one day.',
        example: 6,
        width: 21,
        cellType: 'number',
        numberFormat: '0.0',
      },
      {
        key: 'availabilityMode',
        header: 'Availability Rule',
        required: false,
        description:
          'Use selected_slots_only for part-time or external trainers with fixed free periods.',
        example: 'generally_available',
        acceptedValues: [
          'generally_available',
          'selected_slots_only',
        ],
        width: 24,
        cellType: 'enum',
      },
      {
        key: 'timetableAvailable',
        header: 'Timetable Available',
        required: false,
        defaultValue: 'Yes',
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
