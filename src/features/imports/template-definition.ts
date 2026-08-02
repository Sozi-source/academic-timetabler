import {
  normalizeImportHeader,
} from './header-validation';
import type {
  ImportTemplateDefinition,
} from './types';

export function assertValidTemplateDefinition(
  definition: ImportTemplateDefinition,
) {
  if (!definition.key.trim()) {
    throw new Error(
      'The template definition requires a key.',
    );
  }

  if (!definition.version.trim()) {
    throw new Error(
      'The template definition requires a version.',
    );
  }

  if (definition.columns.length === 0) {
    throw new Error(
      'The template must contain at least one column.',
    );
  }

  const fieldKeys = new Set<string>();
  const headers = new Set<string>();

  for (const column of definition.columns) {
    if (!column.key.trim()) {
      throw new Error(
        'Every import column requires a field key.',
      );
    }

    if (!column.header.trim()) {
      throw new Error(
        `Import field "${column.key}" requires a header.`,
      );
    }

    if (fieldKeys.has(column.key)) {
      throw new Error(
        `Duplicate import field key: ${column.key}.`,
      );
    }

    const normalizedHeader =
      normalizeImportHeader(
        column.header,
      );

    if (headers.has(normalizedHeader)) {
      throw new Error(
        `Duplicate import header: ${column.header}.`,
      );
    }

    fieldKeys.add(column.key);
    headers.add(normalizedHeader);
  }

  return definition;
}