import type {
  NormalizedUnitOfferingImportRow,
} from './types';

interface SharedClassCandidateRow {
  status: string;
  normalizedData:
    | NormalizedUnitOfferingImportRow
    | null;
}

const NON_TIMETABLED_TYPES = new Set([
  'attachment',
  'clinical_rotation',
  'examination',
]);

const INDEPENDENT_OVERRIDES = new Set([
  'independent',
  'no-share',
  'none',
  'separate',
]);

function normalizeWords(
  value: string,
) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\bhiv\s*[/\\-]?\s*aids\b/g, 'hiv and aids')
    .replace(/\bbehavioural\b/g, 'behavioral')
    .replace(/\blife\s+skill\b/g, 'life skills')
    .replace(/\bconvalescent\b/g, 'convalescents')
    .replace(/\bnon\s*-?\s*communicable\b/g, 'non communicable')
    .replace(/\bnon communicable disease\b/g, 'non communicable diseases')
    .replace(/\bnutrition\s+in\s+the\s+lifecycle\b/g, 'nutrition in the lifespan')
    .replace(/\bmaternal\s+and\s+child\s+health\s+nutrition\b/g, 'maternal and child nutrition')
    .replace(/\bnutrition\s+assessment\s+and\s+surveillance\b/g, 'nutrition assessment surveillance')
    .replace(/\bintroduction\s+to\s+nutrition\s+assessment\s+surveillance\b/g, 'nutrition assessment surveillance')
    .replace(/\bapplied\s+physical\s+science\b/g, 'applied physical sciences')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUnitNameForSharing(
  unitName: string,
) {
  return normalizeWords(unitName);
}

function hashText(
  value: string,
) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(
      hash,
      16777619,
    );
  }

  return (hash >>> 0)
    .toString(36)
    .toUpperCase();
}

function toSlug(
  value: string,
) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 82);
}

function buildCandidateIdentity(
  row: NormalizedUnitOfferingImportRow,
) {
  const canonicalName =
    normalizeUnitNameForSharing(
      row.unitName,
    );

  return {
    canonicalName,
    identity: [
      row.academicPeriodId ??
        row.academicPeriod,
      canonicalName,
      row.offeringType,
      row.weeklySessions,
      row.sessionDurationMinutes,
    ].join('|'),
  };
}

function buildAutomaticKey(
  canonicalName: string,
  identity: string,
) {
  const slug =
    toSlug(canonicalName) ||
    'SHARED-CLASS';

  return `AUTO-${slug}-${hashText(identity)}`
    .slice(0, 120);
}

function getSuppliedOverride(
  row: NormalizedUnitOfferingImportRow,
) {
  const value =
    row.sharedClassKey
      ?.trim();

  if (!value) {
    return {
      mode: 'automatic' as const,
      value: undefined,
    };
  }

  if (
    INDEPENDENT_OVERRIDES.has(
      normalizeWords(value)
        .replace(/\s+/g, '-'),
    )
  ) {
    return {
      mode: 'independent' as const,
      value: undefined,
    };
  }

  return {
    mode: 'manual' as const,
    value,
  };
}

export function applyAutomaticSharedClassKeys(
  rows: SharedClassCandidateRow[],
) {
  const automaticCandidates =
    new Map<
      string,
      Array<{
        row: SharedClassCandidateRow;
        normalized:
          NormalizedUnitOfferingImportRow;
        canonicalName: string;
      }>
    >();

  for (const row of rows) {
    if (
      row.status !== 'valid' ||
      !row.normalizedData
    ) {
      continue;
    }

    const normalized =
      row.normalizedData;

    const override =
      getSuppliedOverride(
        normalized,
      );

    if (override.mode === 'manual') {
      row.normalizedData = {
        ...normalized,
        sharedClassKey:
          override.value,
        sharedClassSource:
          'manual',
      };

      continue;
    }

    if (override.mode === 'independent') {
      row.normalizedData = {
        ...normalized,
        sharedClassKey:
          undefined,
        sharedClassSource:
          'independent',
      };

      continue;
    }

    if (
      !normalized.timetableEnabled ||
      NON_TIMETABLED_TYPES.has(
        normalized.offeringType,
      )
    ) {
      row.normalizedData = {
        ...normalized,
        sharedClassKey:
          undefined,
        sharedClassSource:
          'none',
      };

      continue;
    }

    const {
      canonicalName,
      identity,
    } = buildCandidateIdentity(
      normalized,
    );

    const group =
      automaticCandidates.get(
        identity,
      ) ?? [];

    group.push({
      row,
      normalized,
      canonicalName,
    });

    automaticCandidates.set(
      identity,
      group,
    );
  }

  for (const [
    identity,
    group,
  ] of automaticCandidates) {
    const cohortIds = new Set(
      group.map(
        ({ normalized }) =>
          normalized.cohortId ??
          normalized.cohortName,
      ),
    );

    if (
      group.length < 2 ||
      cohortIds.size < 2
    ) {
      for (const item of group) {
        item.row.normalizedData = {
          ...item.normalized,
          sharedClassKey:
            undefined,
          sharedClassSource:
            'none',
          sharedClassMatchName:
            item.canonicalName,
        };
      }

      continue;
    }

    const automaticKey =
      buildAutomaticKey(
        group[0].canonicalName,
        identity,
      );

    for (const item of group) {
      item.row.normalizedData = {
        ...item.normalized,
        sharedClassKey:
          automaticKey,
        sharedClassSource:
          'automatic',
        sharedClassMatchName:
          item.canonicalName,
      };
    }
  }
}
