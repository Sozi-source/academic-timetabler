import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getImportTemplateDefinition,
} from '@/features/imports/templates';

describe(
  'Semester Units on Offer template registration',
  () => {
    it(
      'resolves the Units on Offer template',
      () => {
        const template =
          getImportTemplateDefinition(
            'unit_offerings',
          );

        expect(template).not.toBeNull();

        expect(
          template?.entityType,
        ).toBe('unit_offerings');

        expect(template?.key).toBe(
          'unit-offerings-import',
        );

        expect(template?.version).toBe(
          '1.0',
        );

        expect(
          template?.dataWorksheetName,
        ).toBe('Units on Offer');
      },
    );

    it(
      'contains programme-aware and shared-class columns',
      () => {
        const template =
          getImportTemplateDefinition(
            'unit_offerings',
          );

        const keys =
          template?.columns.map(
            (column) => column.key,
          ) ?? [];

        expect(keys).toContain(
          'programmeName',
        );

        expect(keys).toContain(
          'cohortName',
        );

        expect(keys).toContain(
          'unitName',
        );

        expect(keys).toContain(
          'sharedClassKey',
        );
      },
    );

    it(
      'provides specialized import instructions',
      () => {
        const template =
          getImportTemplateDefinition(
            'unit_offerings',
          );

        expect(
          template?.instructions?.some(
            (instruction) =>
              instruction.includes(
                'Shared Class Key',
              ),
          ),
        ).toBe(true);
      },
    );
  },
);