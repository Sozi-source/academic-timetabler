/**
 * Canonical curriculum-content normalization.
 *
 * Imported Word/Excel content often carries presentation-only numbering and
 * bullet characters (for example `• 1-2 • Meaning of terms`). Those markers
 * must not become part of the curriculum data. This module is deliberately
 * dependency-free so every import, query and renderer can use the same rules.
 */

const RAW_BULLET_CHARS = '\\u2022\\u00b7\\u25cf\\u25aa\\u25e6\\u25cb\\u25c9\\u2043\\u2023\\u204e*';
const BULLET_CHARS = `[${RAW_BULLET_CHARS}]`;

/**
 * Detects whether a string is a presentation/formatting artifact rather than
 * real subtopic content (for example `1`, `1-2`, `(1)`, `•`, `• •`, `CAT`, `Week 1`).
 */
export function isCurriculumArtifactToken(value: string): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;

  // Bare bullets or punctuation only (e.g. "•", "·", "-", "• •", "--", ";", etc.)
  const withoutBulletsAndPunct = trimmed.replace(
    new RegExp(`^[${RAW_BULLET_CHARS}\\s.,;:|()\\[\\]{}–—\\-]+$`, 'u'),
    '',
  ).trim();
  if (!withoutBulletsAndPunct) return true;

  // Strip leading bullets/spaces to inspect the core content
  const core = trimmed.replace(new RegExp(`^[${RAW_BULLET_CHARS}\\s]+`, 'u'), '').trim();
  if (!core) return true;

  // Isolated digits or single list markers: "1", "2", "12", "1.", "1)", "(1)", "[1]"
  if (/^\(?\d{1,4}[.):\]\-–—]?$/.test(core)) return true;

  // Isolated sequence ranges: "1-2", "1 - 2", "1–2", "3-4", "1-2.", "(1-2)", "1/2"
  if (/^\(?\d{1,4}\s*[-–—/]\s*\d{1,4}[.):\]\-–—]?$/.test(core)) return true;

  // Bare structural or timetable labels: "Week 1", "Wk 2", "Lesson 3", "Session 4", "Topic 1", "Part 1", "RAT 1", "CAT", "CAT 1", "Exam"
  if (/^(?:week|wk|lesson|session|topic|part|module|unit|rat|cat|exam)\s*\d*(?:\s*[-–—]\s*\d*)?$/i.test(core)) return true;

  // Bare column headings often captured from Word table headers:
  if (/^(?:content|coverage|sub[\s-]?topics?|topics?|hours?|learning\s+outcomes?|activities|methodolog\w*|assessments?|remarks?|resources?|references?)$/i.test(core)) return true;

  return false;
}

const MEASUREMENT_UNIT_REGEX =
  /^(?:μg|ug|mg|g|kg|ml|l|dl|mmol|mol|kcal|cal|kj|cm|mm|m|hours?|hrs?|days?|weeks?|months?|years?|pts?|points?|%|percent)\b/i;

/** Remove Word/list formatting from the beginning of one curriculum item. */
export function stripCurriculumListPrefix(value: string): string {
  let text = value.replace(/^\uFEFF/, '').trim();

  // Repeatedly remove formatting prefixes because Word conversions can produce
  // combinations such as `• 1-2 • Meaning of terms` or `• • Meaning of terms`.
  for (let i = 0; i < 5; i++) {
    const before = text;
    text = text
      // Leading bullets
      .replace(new RegExp(`^${BULLET_CHARS}+\\s*`, 'u'), '')
      // List markers with delimiter: 1., 1), (1), [1], 1: ; single letter a., a), (a); or roman numerals i., ii., (iii)
      // Strictly excludes multi-letter uppercase tokens like "ATP:" or "DNA:".
      .replace(/^(?:\(?\d{1,3}[.):\]\-–—]|\(?[a-zA-Z][.):\]\-–—]|\(?[ivxIVX]{1,4}[.):\]\-–—])\s+/u, '')
      // Multi-level list numbering: 1.2, 1.2.3, 1.2a followed by delimiter or space
      .replace(/^\d+(?:\.\d+)+(?:[A-Za-z])?[.):\-–—]?\s+/u, '')
      // Imported range followed by delimiter or bullet: 1-2:, 1-2., 1-2), 1-2 - , or 1-2 before bullet
      .replace(new RegExp(`^\\d+\\s*[-–—]\\s*\\d+\\s*(?:[:.)\\-–—]|(?=${BULLET_CHARS}))\\s*`, 'u'), '')
      // Isolated range if the entire string is just the range (e.g. "1-2")
      .replace(/^\d+\s*[-–—]\s*\d+$/u, '')
      .trim();

    // Range prefix followed by space and word (e.g. "1-2 Meaning of terms"):
    // Strip ONLY if the word is NOT a recognized measurement unit (preserves "1–2 μg/day recommended intake")
    const rangeMatch = text.match(/^(\d+\s*[-–—]\s*\d+)\s+([A-Za-zμ%]+)/u);
    if (rangeMatch && !MEASUREMENT_UNIT_REGEX.test(rangeMatch[2])) {
      text = text.slice(rangeMatch[1].length).trim();
    }

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
        // Imported ranges acting as list labels before bullets: `1-2 • Foo 3-4 • Bar`.
        .replace(new RegExp(`\\s+(?=\\d+\\s*[-–—]\\s*\\d+\\s*(?:[:.)\\-–—]|(?=${BULLET_CHARS})))`, 'gu'), '\n');

      const segments = withMarkersAsLines
        .split(new RegExp(`${BULLET_CHARS}+|[;|\\t]+|\\n+`, 'u'))
        .map(stripCurriculumListPrefix)
        .map((part) => part.replace(/^[,;|]+|[,;|]+$/g, '').trim())
        .filter((part) => part.length > 0 && !isCurriculumArtifactToken(part));

      items.push(...segments);
    }
  }

  // Preserve source order while removing exact duplicates created by repeated
  // Word bullets/paragraph runs. Do not collapse merely similar phrases.
  const seen = new Set<string>();
  return items.filter((item) => {
    if (isCurriculumArtifactToken(item)) return false;
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

/**
 * Detects if a text string is an assessment method, examination deliverable,
 * grading rubric, or table artifact rather than an authentic TVET learning outcome.
 */
export function isAssessmentOrEvaluationItem(text?: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t) return false;

  // Single-word artifacts
  if (/^(?:remarks?|evaluation|assessment|grading)$/i.test(t)) return true;

  // Exam / Assessment deliverables and grading rubrics
  if (
    /^(?:final\s+(?:summative\s+)?exam(?:ination)?|portfolio\s+submission|exam\s+papers?|marking\s+schemes?|continuous\s+assessment(?:\s+test)?|cat\s*\d*|rat\s*\d*|end[\s-]term\s+exam(?:ination)?|mid[\s-]term\s+exam(?:ination)?|written\s+exam(?:ination)?|oral\s+exam(?:ination)?|practical\s+exam(?:ination)?)/i.test(t) ||
    /^(?:grading\s+systems?|this\s+course\s+will\s+be\s+graded|grading\s+criteria|assessment\s+weighting|course\s+assessment|evaluation\s+criteria)/i.test(t) ||
    /(?:portfolio\s+submission\s+exam\s+papers|exam\s+papers,\s*marking\s+scheme)/i.test(t)
  ) {
    return true;
  }

  return false;
}

/**
 * Splits and normalizes curriculum learning outcomes into discrete statements.
 * Prevents multiple numbered outcomes from being concatenated into a single blob.
 */
export function normalizeCurriculumLearningOutcomes(
  input?: string | string[] | null,
): string[] {
  if (input === null || input === undefined) return [];

  const rawValues = Array.isArray(input) ? input : [input];
  const outcomes: string[] = [];

  for (const rawValue of rawValues) {
    if (!rawValue) continue;
    const text = String(rawValue).replace(/\r\n?/g, '\n').trim();
    if (!text) continue;

    const lines = text.split(/\n+/u);

    for (const line of lines) {
      const trimmedLine = line.replace(/^[|\s]+/, '').trim();
      if (!trimmedLine) continue;

      // Split inline numbered list items: e.g. "1. Explain... 2. Describe..." or "(a) Explain... (b) Describe..."
      const withSeparators = trimmedLine
        .replace(/\s+(?=(?:\d{1,2}[.)]|\([0-9a-zA-Z]{1,2}\))\s+[A-Z])/gu, '\n')
        .replace(new RegExp(`\\s*(?=${BULLET_CHARS})`, 'gu'), '\n')
        .replace(/\s*(?=(?:UNIT\s+LEARNING\s+OUTCOMES|GRADING\s+SYSTEMS?\s+FOR\s+THE))/gi, '\n');

      const parts = withSeparators.split(/\n+/u);
      for (const part of parts) {
        let cleaned = stripCurriculumListPrefix(part);
        if (!cleaned) continue;

        // Strip leading table characters like '|'
        cleaned = cleaned.replace(/^[|\s]+/, '').trim();

        // Skip pure introductory sentences or headings that contain no actual outcome statement
        if (
          /^(?:by\s+the\s+end\s+of\s+.*?(?:able\s+to|will|competencies)|at\s+the\s+end\s+of\s+.*?(?:able\s+to|will|competencies)|the\s+(?:trainee|learner|student)\s+should\s+be\s+able\s+to|upon\s+successful\s+completion\s+of\s+.*?(?:able\s+to|will|competencies)|expected\s+learning\s+outcomes?|course\s+learning\s+outcomes?|specific\s+learning\s+outcomes?|unit\s+learning\s+outcomes?\s*(?:\/\s*competencies)?|learning\s+outcomes?\s*\/\s*competencies|learning\s+activities(?:\s+remarks)?|grading\s+systems?\s+for\s+the\s+(?:course|unit)|this\s+course\s+will\s+be\s+graded\s+as\s+follows)\s*[:.]?$/i.test(
            cleaned,
          )
        ) {
          continue;
        }

        // If the item starts with an intro clause, strip it cleanly
        const strippedIntro = cleaned
          .replace(/^(?:upon\s+successful\s+completion\s+of\s+[^:]+:\s*(?:\(knowledge[-\s]?based\))?\s*)/i, '')
          .replace(/^(?:by\s+the\s+end\s+of\s+[^:]+:\s*|at\s+the\s+end\s+of\s+[^:]+:\s*)/i, '')
          .replace(/^(?:the\s+(?:trainee|learner|student)\s+should\s+be\s+able\s+to:\s*)/i, '')
          .replace(/^(?:student\s+should\s+be\s+able\s+to:\s*(?:learning\s+activities\s+remarks\s*)?(?:\d{1,2}\/\d{1,2}\/\d{4}\s*)?)/i, '')
          .replace(/\b(?:GRADING\s+SYSTEMS?\s+FOR\s+THE\s+(?:COURSE|UNIT)|THIS\s+COURSE\s+WILL\s+BE\s+GRADED).*$/i, '')
          .trim();

        const finalItem = strippedIntro || cleaned;
        if (
          finalItem &&
          finalItem.length > 3 &&
          !isCurriculumArtifactToken(finalItem) &&
          !isAssessmentOrEvaluationItem(finalItem)
        ) {
          outcomes.push(finalItem.charAt(0).toUpperCase() + finalItem.slice(1));
        }
      }
    }
  }

  // Preserve order while filtering duplicates
  const seen = new Set<string>();
  return outcomes.filter((item) => {
    const key = item.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Clean a topic heading without touching legitimate punctuation inside it. */
export function normalizeCurriculumTopicTitle(input?: string | null): string {
  if (!input) return '';

  let title = stripCurriculumListPrefix(String(input));

  // Topic/Week/Lesson labels are document structure, not part of the title.
  title = title.replace(/^(?:topic|week|lesson|session|module)\s*\d+\s*[:.)-]?\s*/i, '').trim();

  // Numeric curriculum prefixes such as `3.19` or `1-2` are source numbering.
  title = title.replace(/^\d+(?:\.\d+)+(?:[A-Za-z])?\s*[:.)-]?\s*/u, '').trim();
  title = title.replace(/^\d+\s*[-–—]\s*\d+\s*[:.)-]?\s*/u, '').trim();

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
