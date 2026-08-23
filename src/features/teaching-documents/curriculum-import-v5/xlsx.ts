import { unpackZipBuffer } from '../zip-ingestion';
import {
  CONTENT_SHEET_NAMES,
  FIELD_ALIASES,
  UNIT_SHEET_NAMES,
  type CurriculumImportBatchPayloadV5,
  type CurriculumImportContentV5,
  type CurriculumImportDocumentType,
  type CurriculumImportIssueV5,
  type CurriculumImportUnitV5,
} from './schema';

interface RawSheetV5 {
  name: string;
  rows: string[][];
}

type CanonicalField = keyof typeof FIELD_ALIASES;

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeHeader(value: unknown) {
  return normalize(value)
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCode(value: unknown) {
  return normalize(value)
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function normalizeName(value: unknown) {
  return normalize(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function issueId(
  code: string,
  sourceSheet?: string,
  sourceRow?: number,
) {
  return [
    code,
    sourceSheet ?? '',
    sourceRow ?? '',
  ].join(':');
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, raw: string) =>
      String.fromCharCode(Number(raw)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, raw: string) =>
      String.fromCharCode(parseInt(raw, 16)),
    );
}

function columnIndex(reference: string) {
  const letters =
    reference.match(/^([A-Z]+)/i)?.[1]?.toUpperCase() ??
    '';

  let result = 0;

  for (const letter of letters) {
    result =
      result * 26 + letter.charCodeAt(0) - 64;
  }

  return Math.max(0, result - 1);
}

function parseSharedStrings(
  entries: ReturnType<typeof unpackZipBuffer>,
) {
  const entry = entries.find(
    (item) =>
      item.filename === 'xl/sharedStrings.xml',
  );

  if (!entry) return [] as string[];

  const strings: string[] = [];
  const xml = entry.buffer.toString('utf8');

  const siPattern =
    /<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/g;

  let siMatch: RegExpExecArray | null;

  while (
    (siMatch = siPattern.exec(xml)) !== null
  ) {
    const texts: string[] = [];
    const tPattern =
      /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/g;

    let textMatch: RegExpExecArray | null;

    while (
      (textMatch = tPattern.exec(siMatch[1])) !==
      null
    ) {
      texts.push(decodeXml(textMatch[1]));
    }

    strings.push(texts.join(''));
  }

  return strings;
}

function parseRelationships(
  entries: ReturnType<typeof unpackZipBuffer>,
) {
  const entry = entries.find(
    (item) =>
      item.filename ===
      'xl/_rels/workbook.xml.rels',
  );

  const map = new Map<string, string>();

  if (!entry) return map;

  const xml = entry.buffer.toString('utf8');
  const pattern =
    /<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*?)\/?>/g;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const attrs = match[1];

    const id =
      attrs.match(/\bId="([^"]+)"/)?.[1] ?? '';

    const target =
      attrs.match(/\bTarget="([^"]+)"/)?.[1] ??
      '';

    const type =
      attrs.match(/\bType="([^"]+)"/)?.[1] ?? '';

    if (
      id &&
      target &&
      /\/worksheet$/i.test(type)
    ) {
      const normalized = target
        .replace(/^\/+/, '')
        .replace(/^xl\//, '');

      map.set(id, `xl/${normalized}`);
    }
  }

  return map;
}

function parseSheetDefinitions(
  entries: ReturnType<typeof unpackZipBuffer>,
) {
  const entry = entries.find(
    (item) =>
      item.filename === 'xl/workbook.xml',
  );

  if (!entry) {
    return [] as {
      name: string;
      relationshipId: string;
    }[];
  }

  const result: {
    name: string;
    relationshipId: string;
  }[] = [];

  const xml = entry.buffer.toString('utf8');

  const pattern =
    /<(?:[A-Za-z_][\w.-]*:)?sheet\b([^>]*?)\/?>/g;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const attrs = match[1];

    const name =
      attrs.match(/\bname="([^"]+)"/)?.[1] ?? '';

    const relationshipId =
      attrs.match(/\br:id="([^"]+)"/)?.[1] ?? '';

    if (name && relationshipId) {
      result.push({
        name: decodeXml(name),
        relationshipId,
      });
    }
  }

  return result;
}

function parseWorksheetRows(
  xml: string,
  sharedStrings: string[],
) {
  const rows: string[][] = [];

  const rowPattern =
    /<(?:[A-Za-z_][\w.-]*:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row>/g;

  let rowMatch: RegExpExecArray | null;
  let sequentialIndex = 0;

  while (
    (rowMatch = rowPattern.exec(xml)) !== null
  ) {
    const rowAttrs = rowMatch[1];
    const explicitRow = Number(
      rowAttrs.match(/\br="(\d+)"/)?.[1] ?? '',
    );

    const rowIndex =
      Number.isInteger(explicitRow) &&
      explicitRow > 0
        ? explicitRow - 1
        : sequentialIndex;

    sequentialIndex = rowIndex + 1;

    const cells: string[] = [];
    const cellPattern =
      /<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c>/g;

    let cellMatch: RegExpExecArray | null;

    while (
      (cellMatch = cellPattern.exec(rowMatch[2])) !==
      null
    ) {
      const attrs = cellMatch[1];
      const cellXml = cellMatch[2];

      const reference =
        attrs.match(/\br="([^"]+)"/)?.[1] ?? '';

      const index = columnIndex(reference);

      while (cells.length <= index) {
        cells.push('');
      }

      const type =
        attrs.match(/\bt="([^"]+)"/)?.[1] ?? '';

      let value = '';

      if (type === 'inlineStr') {
        const parts: string[] = [];
        const tPattern =
          /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/g;

        let textMatch: RegExpExecArray | null;

        while (
          (textMatch = tPattern.exec(cellXml)) !==
          null
        ) {
          parts.push(decodeXml(textMatch[1]));
        }

        value = parts.join('');
      } else {
        const raw =
          cellXml.match(
            /<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/,
          )?.[1] ?? '';

        if (type === 's') {
          const stringIndex = Number(raw);

          value =
            Number.isInteger(stringIndex) &&
            stringIndex >= 0
              ? sharedStrings[stringIndex] ?? ''
              : '';
        } else {
          value = decodeXml(raw);
        }
      }

      cells[index] = value.trim();
    }

    while (rows.length <= rowIndex) {
      rows.push([]);
    }

    rows[rowIndex] = cells;
  }

  return rows;
}

function readRawWorkbook(
  arrayBuffer: ArrayBuffer,
) {
  const entries = unpackZipBuffer(
    Buffer.from(arrayBuffer),
  );

  if (!entries.length) {
    throw new Error(
      'The uploaded file is not a readable .xlsx workbook.',
    );
  }

  const sharedStrings =
    parseSharedStrings(entries);

  const relationships =
    parseRelationships(entries);

  const definitions =
    parseSheetDefinitions(entries);

  const sheets: RawSheetV5[] = [];

  for (const definition of definitions) {
    const target = relationships.get(
      definition.relationshipId,
    );

    if (!target) continue;

    const entry = entries.find(
      (item) => item.filename === target,
    );

    if (!entry) continue;

    sheets.push({
      name: definition.name,
      rows: parseWorksheetRows(
        entry.buffer.toString('utf8'),
        sharedStrings,
      ),
    });
  }

  if (!sheets.length) {
    throw new Error(
      'The workbook contains no readable worksheets.',
    );
  }

  return sheets;
}

function canonicalField(
  value: string,
): CanonicalField | null {
  const normalized = normalizeHeader(value);

  for (const [field, aliases] of Object.entries(
    FIELD_ALIASES,
  ) as [CanonicalField, readonly string[]][]) {
    if (
      aliases.some(
        (alias) =>
          normalizeHeader(alias) === normalized,
      )
    ) {
      return field;
    }
  }

  return null;
}

function findHeader(
  sheet: RawSheetV5,
) {
  let best:
    | {
        rowIndex: number;
        fields: (CanonicalField | null)[];
        score: number;
      }
    | null = null;

  const maxRows = Math.min(12, sheet.rows.length);

  for (
    let rowIndex = 0;
    rowIndex < maxRows;
    rowIndex += 1
  ) {
    const fields = sheet.rows[rowIndex].map(
      (value) => canonicalField(value),
    );

    const unique = new Set(
      fields.filter(Boolean),
    );

    const score = unique.size;

    if (!best || score > best.score) {
      best = {
        rowIndex,
        fields,
        score,
      };
    }
  }

  return best;
}

function sheetRole(
  sheet: RawSheetV5,
) {
  const header = findHeader(sheet);

  if (!header || header.score < 2) {
    return null;
  }

  const fieldSet = new Set(
    header.fields.filter(Boolean),
  );

  const normalizedName = normalizeHeader(
    sheet.name,
  );

  const unitNameHint = UNIT_SHEET_NAMES.some(
    (name) =>
      normalizeHeader(name) === normalizedName,
  );

  const contentNameHint = CONTENT_SHEET_NAMES.some(
    (name) =>
      normalizeHeader(name) === normalizedName,
  );

  const hasUnitIdentity =
    fieldSet.has('unit_code') ||
    fieldSet.has('unit_name');

  const hasTopic = fieldSet.has('topic');

  if (
    hasTopic &&
    (fieldSet.has('sequence') ||
      hasUnitIdentity ||
      contentNameHint)
  ) {
    return {
      role: 'content' as const,
      header,
    };
  }

  if (
    hasUnitIdentity &&
    (fieldSet.has('content_family_key') ||
      fieldSet.has('unit_description') ||
      unitNameHint)
  ) {
    return {
      role: 'units' as const,
      header,
    };
  }

  return null;
}

function rowRecord(
  sheet: RawSheetV5,
  rowIndex: number,
  fields: (CanonicalField | null)[],
) {
  const row = sheet.rows[rowIndex] ?? [];
  const result: Partial<Record<CanonicalField, string>> =
    {};

  fields.forEach((field, columnIndex) => {
    if (!field) return;

    const value = normalize(row[columnIndex]);

    if (
      value &&
      !result[field]
    ) {
      result[field] = value;
    }
  });

  return result;
}

function sourceUnitKey(
  code: string,
  name: string,
) {
  if (code) return `code:${normalizeCode(code)}`;

  return `name:${normalizeName(name)}`;
}

function documentTypeFromRecord(
  value: string,
  sheetName: string,
): CurriculumImportDocumentType {
  const haystack = [
    value,
    sheetName,
  ]
    .join(' ')
    .toLowerCase();

  if (
    /scheme|learning plan|delivery plan/.test(
      haystack,
    )
  ) {
    return 'scheme_of_work';
  }

  if (/course outline|outline/.test(haystack)) {
    return 'course_outline';
  }

  return 'unknown';
}

function calendarActivity(topic: string) {
  return /\b(cat(?:s)?|continuous\s+assessment\s+test|exam(?:ination)?s?|revision|rat|readiness\s+assessment\s+test|holiday)\b/i.test(
    topic,
  );
}

export async function parseCurriculumWorkbookV5(
  arrayBuffer: ArrayBuffer,
  fileName: string,
): Promise<
  Omit<
    CurriculumImportBatchPayloadV5,
    'units'
  > & {
    units: Omit<
      CurriculumImportUnitV5,
      | 'matchedUnitId'
      | 'matchedUnitCode'
      | 'matchedUnitName'
      | 'matchMethod'
    >[];
  }
> {
  const sheets = readRawWorkbook(arrayBuffer);

  const issues: CurriculumImportIssueV5[] =
    [];

  const unitsByKey = new Map<
    string,
    Omit<
      CurriculumImportUnitV5,
      | 'matchedUnitId'
      | 'matchedUnitCode'
      | 'matchedUnitName'
      | 'matchMethod'
    >
  >();

  const content: CurriculumImportContentV5[] =
    [];

  for (const sheet of sheets) {
    const detected = sheetRole(sheet);

    if (!detected) continue;

    const {
      role,
      header,
    } = detected;

    for (
      let rowIndex = header.rowIndex + 1;
      rowIndex < sheet.rows.length;
      rowIndex += 1
    ) {
      const record = rowRecord(
        sheet,
        rowIndex,
        header.fields,
      );

      if (role === 'units') {
        const code = normalizeCode(
          record.unit_code ?? '',
        );

        const name = normalize(
          record.unit_name ?? '',
        );

        if (!code && !name) continue;

        const key = sourceUnitKey(
          code,
          name,
        );

        const documentType =
          documentTypeFromRecord(
            record.document_type ?? '',
            sheet.name,
          );

        const existing =
          unitsByKey.get(key);

        const next = {
          sourceUnitKey: key,
          sourceUnitCode: code,
          sourceUnitName: name || code,
          documentType:
            documentType !== 'unknown'
              ? documentType
              : existing?.documentType ??
                'unknown',
          contentFamilyKey:
            normalize(
              record.content_family_key ?? '',
            ) ||
            existing?.contentFamilyKey ||
            code ||
            normalizeName(name)
              .replace(/\s+/g, '_')
              .toUpperCase(),
          curriculumVersion: Number(
            record.curriculum_version ?? 1,
          ) || 1,
          unitDescription:
            normalize(
              record.unit_description ?? '',
            ) ||
            existing?.unitDescription ||
            '',
          coreLearningOutcomes:
            normalize(
              record.core_learning_outcomes ?? '',
            ) ||
            existing?.coreLearningOutcomes ||
            '',
          teachingLearningApproaches:
            normalize(
              record.teaching_learning_approaches ??
                '',
            ) ||
            existing?.teachingLearningApproaches ||
            '',
          assessmentApproaches:
            normalize(
              record.assessment_approaches ?? '',
            ) ||
            existing?.assessmentApproaches ||
            '',
          referencesResources:
            normalize(
              record.references_resources ?? '',
            ) ||
            existing?.referencesResources ||
            '',
        };

        unitsByKey.set(key, next);
      }

      if (role === 'content') {
        const code = normalizeCode(
          record.unit_code ?? '',
        );

        const name = normalize(
          record.unit_name ?? '',
        );

        const topic = normalize(
          record.topic ?? '',
        );

        if (!topic) continue;

        const key = sourceUnitKey(
          code,
          name,
        );

        if (
          !code &&
          !name
        ) {
          issues.push({
            id: issueId(
              'content_without_unit',
              sheet.name,
              rowIndex + 1,
            ),
            severity: 'review',
            code: 'content_without_unit',
            message:
              'A content row has a topic but no unit code or unit name.',
            sourceSheet: sheet.name,
            sourceRow: rowIndex + 1,
          });

          continue;
        }

        if (!unitsByKey.has(key)) {
          unitsByKey.set(key, {
            sourceUnitKey: key,
            sourceUnitCode: code,
            sourceUnitName: name || code,
            documentType:
              documentTypeFromRecord(
                record.document_type ?? '',
                sheet.name,
              ),
            contentFamilyKey:
              code ||
              normalizeName(name)
                .replace(/\s+/g, '_')
                .toUpperCase(),
            curriculumVersion: 1,
            unitDescription: '',
            coreLearningOutcomes: '',
            teachingLearningApproaches: '',
            assessmentApproaches: '',
            referencesResources: '',
          });
        }

        const explicitSequence = Number(
          record.sequence ?? '',
        );

        const nextSequence =
          Number.isFinite(explicitSequence) &&
          explicitSequence > 0
            ? Math.trunc(explicitSequence)
            : content.filter(
                (item) =>
                  item.sourceUnitKey === key,
              ).length + 1;

        const excludedAsCalendarActivity =
          calendarActivity(topic);

        if (excludedAsCalendarActivity) {
          issues.push({
            id: issueId(
              'calendar_activity',
              sheet.name,
              rowIndex + 1,
            ),
            severity: 'warning',
            code: 'calendar_activity',
            message: `"${topic}" looks like an academic-calendar activity and will not be imported as curriculum content.`,
            sourceUnitKey: key,
            sourceSheet: sheet.name,
            sourceRow: rowIndex + 1,
          });
        }

        content.push({
          sourceUnitKey: key,
          sequence: nextSequence,
          sourceWeek:
            Number.isFinite(explicitSequence) &&
            explicitSequence > 0
              ? Math.trunc(explicitSequence)
              : null,
          topic,
          coverage: normalize(
            record.coverage ?? '',
          ),
          learningOutcomes: normalize(
            record.learning_outcomes ?? '',
          ),
          activities: normalize(
            record.activities ?? '',
          ),
          assessment: normalize(
            record.assessment ?? '',
          ),
          resources: normalize(
            record.resources ?? '',
          ),
          sourceSheet: sheet.name,
          sourceRow: rowIndex + 1,
          excludedAsCalendarActivity,
        });
      }
    }
  }

  const units = [
    ...unitsByKey.values(),
  ];

  if (!units.length && !content.length) {
    throw new Error(
      'No recognizable curriculum unit/content tables were found. Use a workbook with unit details and/or topic/content columns.',
    );
  }

  for (const unit of units) {
    if (!unit.sourceUnitCode) {
      issues.push({
        id: issueId(
          'missing_unit_code',
          unit.sourceUnitKey,
        ),
        severity: 'review',
        code: 'missing_unit_code',
        message: `${unit.sourceUnitName || 'Unit'} has no source unit code. It can still be mapped manually in the review screen.`,
        sourceUnitKey: unit.sourceUnitKey,
      });
    }

    const unitContent = content.filter(
      (item) =>
        item.sourceUnitKey ===
          unit.sourceUnitKey &&
        !item.excludedAsCalendarActivity,
    );

    if (!unitContent.length) {
      issues.push({
        id: issueId(
          'unit_without_content',
          unit.sourceUnitKey,
        ),
        severity: 'review',
        code: 'unit_without_content',
        message: `${unit.sourceUnitName || unit.sourceUnitCode} has no importable curriculum topics.`,
        sourceUnitKey: unit.sourceUnitKey,
      });
    }
  }

  const documentTypes = new Set(
    units
      .map((unit) => unit.documentType)
      .filter(
        (type) => type !== 'unknown',
      ),
  );

  const documentType:
    CurriculumImportDocumentType =
      documentTypes.size === 1
        ? [...documentTypes][0]
        : 'unknown';

  return {
    engineVersion: 5,
    documentType,
    units,
    content,
    issues: [
      ...new Map(
        issues.map((issue) => [
          issue.id,
          issue,
        ]),
      ).values(),
    ],
    source: {
      fileName,
      parser: 'xlsx-flex-v5',
    },
  };
}
