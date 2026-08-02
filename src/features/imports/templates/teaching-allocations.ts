import {
  IMPORT_WORKSHEET_NAMES,
} from '../constants';
import {
  assertValidTemplateDefinition,
} from '../template-definition';

export const teachingAllocationsImportTemplate =
  assertValidTemplateDefinition({
    key: 'hnd-teaching-allocations',
    entityType: 'teaching_allocations',
    version: '1.0',
    displayName: 'Teaching Allocations',
    instructionsWorksheetName:
      IMPORT_WORKSHEET_NAMES.instructions,
    dataWorksheetName:
      IMPORT_WORKSHEET_NAMES.data,
    metadataWorksheetName:
      IMPORT_WORKSHEET_NAMES.metadata,
    maximumRows: 10000,
    columns: [
      {
        key: 'academicPeriodCode',
        header: 'Academic Period Code',
        required: true,
        description:
          'Code of the Academic Period receiving the allocation.',
        example: '2026-SEM-1',
        width: 24,
        cellType: 'text',
      },
      {
        key: 'cohortCode',
        header: 'Cohort Code',
        required: true,
        description:
          'Code of the cohort receiving the unit.',
        example: 'DHN-SEP-2026',
        width: 24,
        cellType: 'text',
      },
      {
        key: 'unitCode',
        header: 'Unit Code',
        required: true,
        description:
          'Unit code belonging to the cohort programme.',
        example: 'NUT-101',
        width: 20,
        cellType: 'text',
      },
      {
        key: 'trainerStaffNumber',
        header: 'Trainer Staff Number',
        required: true,
        description:
          'Official staff number of the assigned trainer.',
        example: 'TR-001',
        width: 25,
        cellType: 'text',
      },
      {
        key: 'preferredRoomCode',
        header: 'Preferred Room Code',
        required: false,
        description:
          'Optional code of the preferred teaching room.',
        example: 'LAB-01',
        width: 24,
        cellType: 'text',
      },
      {
        key: 'deliveryMode',
        header: 'Delivery Mode',
        required: true,
        description:
          'Primary mode used to deliver the allocation.',
        example: 'theory',
        acceptedValues: [
          'theory',
          'practical',
          'clinical',
          'blended',
          'project',
          'other',
        ],
        width: 20,
        cellType: 'enum',
      },
      {
        key: 'weeklySessions',
        header: 'Weekly Sessions',
        required: true,
        description:
          'Number of sessions required each week.',
        example: 3,
        width: 19,
        cellType: 'integer',
        numberFormat: '0',
      },
      {
        key: 'sessionDurationMinutes',
        header: 'Session Duration Minutes',
        required: true,
        description:
          'Duration of one session in minutes, using 15-minute increments.',
        example: 120,
        width: 27,
        cellType: 'integer',
        numberFormat: '0',
      },
      {
        key: 'status',
        header: 'Status',
        required: true,
        description:
          'Lifecycle status for the allocation.',
        example: 'draft',
        acceptedValues: [
          'draft',
          'active',
          'suspended',
          'completed',
          'archived',
        ],
        width: 18,
        cellType: 'enum',
      },
      {
        key: 'timetableEnabled',
        header: 'Timetable Enabled',
        required: true,
        description:
          'Whether the allocation should be considered by the generator.',
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
          'Optional allocation or scheduling notes.',
        example:
          'Prioritize morning sessions.',
        width: 38,
        cellType: 'text',
      },
    ],
  });