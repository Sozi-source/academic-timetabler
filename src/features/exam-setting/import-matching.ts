export interface ImportMatchUnit {
  id: string;
  code: string;
  name: string;
}

function titleWords(value: string): Set<string> {
  const ignored = new Set(['a', 'and', 'for', 'in', 'of', 'the', 'to', 'with']);
  const normalized = value.normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return new Set(normalized.split(/\s+/).filter((word) => word.length > 0 && !ignored.has(word)));
}

function titlesMatch(paperTitle: string, unitName: string): boolean {
  const paperWords = titleWords(paperTitle);
  const unitWords = titleWords(unitName);
  if (paperWords.size < 2 || unitWords.size < 2) return false;
  const shared = [...paperWords].filter((word) => unitWords.has(word)).length;
  const union = new Set([...paperWords, ...unitWords]).size;
  return shared / union >= 0.8;
}

/** Match from the parsed unit title only; printed paper codes are unreliable. */
export function findConfidentImportUnit(
  paperTitle: string | null,
  units: ImportMatchUnit[],
): ImportMatchUnit | null {
  if (!paperTitle) return null;
  const matches = units.filter((unit) => titlesMatch(paperTitle, unit.name));
  return matches.length === 1 ? matches[0] : null;
}
