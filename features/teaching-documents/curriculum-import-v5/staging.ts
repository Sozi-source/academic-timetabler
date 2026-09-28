import {
  type CurriculumImportBatchPayloadV5,
  type CurriculumImportIssueV5,
  type CurriculumImportUnitV5,
  type SystemUnitForImportV5,
} from './schema';

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.]+/g, '');
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function issue(
  severity: CurriculumImportIssueV5['severity'],
  code: string,
  message: string,
  sourceUnitKey: string,
): CurriculumImportIssueV5 {
  return {
    id: `${code}:${sourceUnitKey}`,
    severity,
    code,
    message,
    sourceUnitKey,
  };
}

export function matchCurriculumUnitsV5(
  parsed: Omit<
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
  },
  systemUnits: SystemUnitForImportV5[],
): CurriculumImportBatchPayloadV5 {
  const byCode = new Map<
    string,
    SystemUnitForImportV5[]
  >();

  const byName = new Map<
    string,
    SystemUnitForImportV5[]
  >();

  for (const unit of systemUnits) {
    const codeKey = normalizeCode(unit.code);
    const nameKey = normalizeName(unit.name);

    byCode.set(codeKey, [
      ...(byCode.get(codeKey) ?? []),
      unit,
    ]);

    byName.set(nameKey, [
      ...(byName.get(nameKey) ?? []),
      unit,
    ]);
  }

  const issues = [...parsed.issues];

  const units: CurriculumImportUnitV5[] =
    parsed.units.map((sourceUnit) => {
      const sourceCodeKey = normalizeCode(
        sourceUnit.sourceUnitCode,
      );

      const sourceNameKey = normalizeName(
        sourceUnit.sourceUnitName,
      );

      const codeMatches = sourceCodeKey
        ? byCode.get(sourceCodeKey) ?? []
        : [];

      if (codeMatches.length === 1) {
        const matched = codeMatches[0];

        return {
          ...sourceUnit,
          matchedUnitId: matched.id,
          matchedUnitCode: matched.code,
          matchedUnitName: matched.name,
          matchMethod:
            sourceUnit.sourceUnitCode ===
            matched.code.toUpperCase()
              ? 'exact_code'
              : 'normalized_code',
        };
      }

      const nameMatches = sourceNameKey
        ? byName.get(sourceNameKey) ?? []
        : [];

      if (nameMatches.length === 1) {
        const matched = nameMatches[0];

        issues.push(
          issue(
            'warning',
            'matched_by_name',
            `${sourceUnit.sourceUnitName} was matched to ${matched.code} — ${matched.name} by unit name.`,
            sourceUnit.sourceUnitKey,
          ),
        );

        return {
          ...sourceUnit,
          matchedUnitId: matched.id,
          matchedUnitCode: matched.code,
          matchedUnitName: matched.name,
          matchMethod: 'exact_name',
        };
      }

      if (codeMatches.length > 1) {
        issues.push(
          issue(
            'review',
            'ambiguous_code',
            `${sourceUnit.sourceUnitCode} matches more than one active system unit. Select the correct unit manually.`,
            sourceUnit.sourceUnitKey,
          ),
        );
      } else if (nameMatches.length > 1) {
        issues.push(
          issue(
            'review',
            'ambiguous_name',
            `${sourceUnit.sourceUnitName} matches more than one active system unit. Select the correct unit manually.`,
            sourceUnit.sourceUnitKey,
          ),
        );
      } else {
        issues.push(
          issue(
            'review',
            'unit_not_mapped',
            `${sourceUnit.sourceUnitCode || sourceUnit.sourceUnitName} is not mapped to a system unit yet.`,
            sourceUnit.sourceUnitKey,
          ),
        );
      }

      return {
        ...sourceUnit,
        matchedUnitId: null,
        matchedUnitCode: null,
        matchedUnitName: null,
        matchMethod: 'unmatched',
      };
    });

  return {
    ...parsed,
    units,
    issues: [
      ...new Map(
        issues.map((item) => [
          item.id,
          item,
        ]),
      ).values(),
    ],
  };
}

export function unresolvedUnitsV5(
  payload: CurriculumImportBatchPayloadV5,
) {
  return payload.units.filter(
    (unit) => !unit.matchedUnitId,
  );
}
