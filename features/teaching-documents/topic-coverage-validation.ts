type TopicCoverageRow = {
  topic: string;
  coverage: string;
};

function significantWords(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .match(/[a-z0-9]{3,}/g)
    ?.filter((word) => !['and', 'the', 'for', 'from', 'with', 'into', 'terms'].includes(word)) ?? [];
}

function normalizeCoverage(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Detects outlines where the topic column appears to contain copied subtopic prose.
 * Requires repeated evidence across multiple rows so legitimate long or grouped
 * topic titles in other units are left alone.
 */
export function hasTopicCoverageContamination(rows: TopicCoverageRow[]): boolean {
  const contaminatedRows = rows.filter(({ topic, coverage }) => {
    const topicWords = significantWords(topic);
    if (topic.length < 90 || topicWords.length < 12 || !coverage.trim()) return false;

    const coverageWords = new Set(significantWords(coverage));
    const overlap = topicWords.filter((word) => coverageWords.has(word)).length / topicWords.length;
    return overlap >= 0.7;
  });

  if (contaminatedRows.length >= 2) return true;

  const coverageCounts = new Map<string, number>();
  for (const { coverage } of rows) {
    const normalized = normalizeCoverage(coverage);
    if (normalized) coverageCounts.set(normalized, (coverageCounts.get(normalized) ?? 0) + 1);
  }

  return contaminatedRows.length === 1 && [...coverageCounts.values()].some((count) => count >= 3);
}
