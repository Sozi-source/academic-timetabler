/**
 * Canonical curriculum-content normalization.
 *
 * Imported Word/Excel content often carries presentation-only numbering and
 * bullet characters (for example `• 1-2 • Meaning of terms`). Those markers
 * must not become part of the curriculum data. This module is deliberately
 * dependency-free so every import, query and renderer can use the same rules.
 */

const BULLET_CHARS = '[\\u2022\\u00b7\\u25cf\\u25aa\\u25e6\\u25cb\\u25c9\\u2043\\u2023\\u204e*]';

/** Remove Word/list formatting from the beginning of one curriculum item. */
export function stripCurriculumListPrefix(value: string): string {
  let text = value.replace(/^\uFEFF/, '').trim();

  // Repeatedly remove formatting prefixes because Word conversions can produce
  // combinations such as `• 1-2 • Meaning of terms`.
  for (let i = 0; i < 5; i++) {
    const before = text;
    text = text
      .replace(new RegExp(`^${BULLET_CHARS}\\s*`, 'u'), '')
      // 1-2, 1–2, 1—2 used as imported sequence/list labels.
      .replace(/^\d+\s*[-–—]\s*\d+\s*[:.)-]?\s*/u, '')
      // 1.2, 1.2.3 or 1.2a document/list numbering.
      .replace(/^\d+(?:\.\d+)+(?:[A-Za-z])?\s*[:.)-]?\s*/u, '')
      // 1., 1), (1), a., a), (a), i., etc.
      .replace(/^\(?[A-Za-z0-9]{1,3}[.)]\s*/u, '')
      // A plain numeric list marker such as `1 Meaning...`.
      .replace(/^\d{1,3}\s+(?=[A-Za-z])/u, '')
      .trim();

    if (text === before) break;
  }

  return text
    .replace(/^[-–—]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a raw coverage/subtopic value into real curriculum points.
 *
 * We intentionally do NOT split on commas or the word `and`; those are often
 * legitimate parts of a single subtopic.
 */
export function normalizeCurriculumSubtopics(input?: string | string[] | null): string[] {
  if (input === null || input === undefined) return [];

  const rawValues = Array.isArray(input) ? input : [input];
  const items: string[] = [];

  for (const rawValue of rawValues) {
    if (rawValue === null || rawValue === undefined) continue;
    const raw = String(rawValue).replace(/\r\n?/g, '\n').trim();
    if (!raw) continue;

    // First preserve explicit Word paragraphs/new lines. Then split inline
    // bullet/semicolon/middle-dot delimiters that may have been flattened by
    // a DOCX parser.
    const lines = raw.split(/\n+/u);

    for (const line of lines) {
      if (!line.trim()) continue;

      const withMarkersAsLines = line
        .replace(new RegExp(`\\s*(?=${BULLET_CHARS})`, 'gu'), '\n')
        // Inline numbered lists: `1. Foo 2. Bar` / `1) Foo 2) Bar`.
        .replace(/\s+(?=\d{1,3}\s*[.)]\s+)/gu, '\n')
        // Imported ranges frequently act as list labels: `1-2 Foo 3-4 Bar`.
        .replace(/\s+(?=\d+\s*[-–—]\s*\d+\s+[A-Za-z])/gu, '\n');

      const segments = withMarkersAsLines
        .split(new RegExp(`${BULLET_CHARS}+|[;|\\t]+|\\n+`, 'u'))
        .map(stripCurriculumListPrefix)
        .map((part) => part.replace(/^[,;|]+|[,;|]+$/g, '').trim())
        .filter((part) => part.length > 0);

      items.push(...segments);
    }
  }

  // Preserve source order while removing exact duplicates created by repeated
  // Word bullets/paragraph runs. Do not collapse merely similar phrases.
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Store canonical subtopics as one item per physical line. */
export function serializeCurriculumSubtopics(input?: string | string[] | null): string {
  return normalizeCurriculumSubtopics(input).join('\n');
}

/** Clean a topic heading without touching legitimate punctuation inside it. */
export function normalizeCurriculumTopicTitle(input?: string | null): string {
  if (!input) return '';

  let title = stripCurriculumListPrefix(String(input));

  // Topic/Week/Lesson labels are document structure, not part of the title.
  title = title.replace(/^(?:topic|week|lesson|session|module)\s*\d+\s*[:.)-]\s*/i, '').trim();

  // Numeric curriculum prefixes such as `3.19` are source numbering.
  title = title.replace(/^\d+(?:\.\d+)+(?:[A-Za-z])?\s*[:.)-]?\s*/u, '').trim();

  // Older distribution-engine versions appended `(Part X)` when one topic
  // occupied several weeks. That marker is implementation detail, not part
  // of the topic identity, so remove it at the normalization boundary too.
  title = title.replace(/\s*\(Part\s+\d+\)\s*$/i, '').trim();

  return title.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize weekly schedule content without changing its weekly records.
 * This is intentionally presentation/data hygiene only: weeks are never
 * merged here because downstream assessment and timetable logic needs them.
 */
export function normalizeWeeklySchedule<T extends { topicTitle: string; subTopics?: string[] | string }>(
  schedule: T[] | null | undefined,
): T[] {
  if (!Array.isArray(schedule)) return [];

  return schedule.map((week) => ({
    ...week,
    topicTitle: normalizeCurriculumTopicTitle(week.topicTitle),
    subTopics: normalizeCurriculumSubtopics(week.subTopics),
  })) as T[];
}

/**
 * Returns the contiguous visual span for a topic cell. A topic is merged only
 * with immediately adjacent weeks having the same normalized title. This
 * prevents W2/W4 from being merged when another topic occurs at W3.
 */
export function getContiguousTopicSpan<T extends { topicTitle: string }>(
  schedule: T[],
  index: number,
): { isStart: boolean; rowSpan: number } {
  if (index < 0 || index >= schedule.length) return { isStart: false, rowSpan: 1 };

  const key = normalizeCurriculumTopicTitle(schedule[index].topicTitle).toLocaleLowerCase();
  const previousKey = index > 0
    ? normalizeCurriculumTopicTitle(schedule[index - 1].topicTitle).toLocaleLowerCase()
    : null;

  if (previousKey === key) return { isStart: false, rowSpan: 1 };

  let rowSpan = 1;
  for (let i = index + 1; i < schedule.length; i++) {
    const nextKey = normalizeCurriculumTopicTitle(schedule[i].topicTitle).toLocaleLowerCase();
    if (nextKey !== key) break;
    rowSpan++;
  }

  return { isStart: true, rowSpan };
}
