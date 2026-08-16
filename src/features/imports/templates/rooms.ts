import {
  IMPORT_WORKSHEET_NAMES,
} from '../constants';
import {
  assertValidTemplateDefinition,
} from '../template-definition';

export const roomsImportTemplate =
  assertValidTemplateDefinition({
    key: 'hnd-rooms',
    entityType: 'rooms',
    version: '2.0',
    displayName: 'Rooms',
    instructionsWorksheetName:
      IMPORT_WORKSHEET_NAMES.instructions,
    dataWorksheetName:
      IMPORT_WORKSHEET_NAMES.data,
    metadataWorksheetName:
      IMPORT_WORKSHEET_NAMES.metadata,
    maximumRows: 3000,
    columns: [
      {
        key: 'code',
        header: 'Room Code',
        required: true,
        description:
          'Official unique room identifier.',
        example: 'LAB-01',
        width: 18,
        cellType: 'text',
      },
      {
        key: 'name',
        header: 'Room Name',
        required: true,
        description:
          'Official room or teaching-space name.',
        example: 'Nutrition Laboratory',
        width: 30,
        cellType: 'text',
      },
      {
        key: 'roomType',
        header: 'Room Type',
        required: false,
        defaultValue: 'lecture_room',
        description:
          'Select the room category that best describes the space.',
        example: 'laboratory',
        acceptedValues: [
          'lecture_room',
          'laboratory',
          'skills_room',
          'computer_lab',
          'kitchen',
          'conference_room',
          'other',
        ],
        width: 22,
        cellType: 'enum',
      },
      {
        key: 'capacity',
        header: 'Capacity',
        required: true,
        description:
          'Maximum safe learner capacity.',
        example: 40,
        width: 14,
        cellType: 'integer',
        numberFormat: '0',
      },
      {
        key: 'building',
        header: 'Building',
        required: false,
        description:
          'Building or block where the room is located.',
        example: 'Main Academic Block',
        width: 28,
        cellType: 'text',
      },
      {
        key: 'floor',
        header: 'Floor',
        required: false,
        description:
          'Floor or level description.',
        example: 'Ground Floor',
        width: 20,
        cellType: 'text',
      },
      {
        key: 'timetableAvailable',
        header: 'Timetable Available',
        required: false,
        defaultValue: 'Yes',
        description:
          'Whether the room should be available for scheduling.',
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
          'Optional facilities or scheduling information.',
        example:
          'Suitable for food-analysis practicals.',
        width: 38,
        cellType: 'text',
      },
    ],
  });
