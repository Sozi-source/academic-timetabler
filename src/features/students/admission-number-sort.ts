const admissionCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
});

function normalizedAdmissionNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function admissionSequence(value: string): number | null {
  const normalized = normalizedAdmissionNumber(value);
  const beforeInstitutionCode = normalized.split('/IC/')[0] ?? normalized;
  const matches = [...beforeInstitutionCode.matchAll(/\d+/g)];

  if (matches.length === 0) {
    return null;
  }

  const candidate = Number(matches.at(-1)?.[0]);
  return Number.isFinite(candidate) ? candidate : null;
}

export function compareAdmissionNumbers(
  first: string,
  second: string,
): number {
  const firstSequence = admissionSequence(first);
  const secondSequence = admissionSequence(second);

  if (
    firstSequence !== null &&
    secondSequence !== null &&
    firstSequence !== secondSequence
  ) {
    return firstSequence - secondSequence;
  }

  return admissionCollator.compare(
    normalizedAdmissionNumber(first),
    normalizedAdmissionNumber(second),
  );
}

