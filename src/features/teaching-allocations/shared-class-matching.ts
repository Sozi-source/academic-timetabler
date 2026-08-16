export function canonicalizeSharedUnitTitle(
  value: string,
) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\blife\s*span\b/g, 'life cycle')
    .replace(/\blife\s*cycle\b/g, 'life cycle')
    .replace(/\bapplied physical science\b/g, 'applied physical sciences')
    .replace(/\bnon communicable disease\b/g, 'non communicable diseases')
    .replace(/\s+/g, ' ');

  if (
    normalized === 'diet therapy 1' ||
    normalized === 'diet therapy i'
  ) {
    return 'diet therapy';
  }

  if (normalized === 'diet therapy iii theory') {
    return 'diet therapy iii';
  }

  if (
    normalized ===
      'introduction to nutrition assessment and surveillance'
  ) {
    return 'nutrition assessment and surveillance';
  }

  return normalized;
}

export function buildSharedClassMatchKey({
  title,
  sessionDurationMinutes,
}: {
  title: string;
  sessionDurationMinutes: number;
}) {
  return [
    canonicalizeSharedUnitTitle(title),
    sessionDurationMinutes,
  ].join(':');
}
