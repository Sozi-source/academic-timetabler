import { unpackZipBuffer } from '../zip-ingestion';

export interface ParsedDocxSyllabus {
  unitCode?: string;
  unitName?: string;
  unitDescription?: string;
  overallCompetencies?: string;
  references?: string;
  topics: {
    topicTitle: string;
    subTopics: string;
  }[];
}

/**
 * Clean and decode XML text strings
 */
function cleanXmlString(xml: string): string {
  return xml
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \f\v]+/g, ' ')
    .trim();
}

/**
 * Extracts structured text and tables from Word (.docx) document.xml
 */
export function parseDocxSyllabus(docxBuffer: Buffer): ParsedDocxSyllabus {
  try {
    const entries = unpackZipBuffer(docxBuffer);
    const documentXmlEntry = entries.find((e) => e.filename === 'word/document.xml');
    if (!documentXmlEntry) {
      throw new Error('Invalid Word document: word/document.xml not found.');
    }

    const xml = documentXmlEntry.buffer.toString('utf8');

    // 1. Detect Unit Code: e.g. "DHN 2304", "NUT 101", "CLIN 201", "CND 1102"
    const codeRegex = /\b([A-Z]{2,6})\s*([0-9]{3,4}[A-Z]?)\b/i;
    const matchCode = xml.replace(/<[^>]+>/g, ' ').match(codeRegex);
    const unitCode = matchCode ? `${matchCode[1].toUpperCase()} ${matchCode[2].toUpperCase()}` : '';

    // 2. Detect Unit Name / Title
    let unitName = '';
    const titleRegex = /(?:Unit|Course|Module)\s*(?:Title|Name)?\s*[:=-]\s*([^\n\r<]+)/i;
    const matchTitle = xml.match(titleRegex);
    if (matchTitle && matchTitle[1]) {
      unitName = cleanXmlString(matchTitle[1].replace(/<[^>]+>/g, ''));
    }

    // 3. Extract plain-text paragraphs for metadata extraction
    const allParas: string[] = [];
    const allParaRegex = /(<w:p\b[\s\S]*?<\/w:p>)/g;
    let apm: RegExpExecArray | null;
    while ((apm = allParaRegex.exec(xml)) !== null) {
      const texts = apm[1].match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const t = texts.map((x) => x.replace(/<[^>]+>/g, '')).join(' ').trim();
      const c = cleanXmlString(t);
      if (c) allParas.push(c);
    }

    // Extract unit description (paragraph after "description", "purpose", "overview" heading)
    let unitDescription: string | undefined;
    let overallCompetencies: string | undefined;

    for (let i = 0; i < allParas.length; i++) {
      const lower = allParas[i].toLowerCase();
      if (
        /unit\s+description|overall\s+purpose|course\s+description|unit\s+overview|purpose\s+of\s+(the\s+)?unit/i.test(lower)
      ) {
        // Take next non-empty paragraph as the description
        for (let j = i + 1; j < Math.min(i + 4, allParas.length); j++) {
          const candidate = allParas[j];
          if (
            candidate.length > 20 &&
            !/learning\s+outcome|competenc|objective/i.test(candidate)
          ) {
            unitDescription = candidate;
            break;
          }
        }
      }
      if (
        /learning\s+outcome|core\s+competenc|expected\s+outcome|competencies/i.test(lower)
      ) {
        // Collect the next few lines as competencies
        const lines: string[] = [];
        for (let j = i + 1; j < Math.min(i + 8, allParas.length); j++) {
          const candidate = allParas[j];
          if (
            candidate.length > 5 &&
            !/weekly\s+delivery|topical\s+breakdown|week\s+\d|teaching|assessment/i.test(candidate)
          ) {
            lines.push(candidate.replace(/^\d+[\.\)]\s*/, '').trim());
          } else {
            break;
          }
        }
        if (lines.length > 0) overallCompetencies = lines.join(' ');
      }
    }

    // 4. Extract Tables if present
    const tableTopics: { topicTitle: string; subTopics: string }[] = [];
    const tableRegex = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
    let tblMatch: RegExpExecArray | null;

    while ((tblMatch = tableRegex.exec(xml)) !== null) {
      const tableContent = tblMatch[0];
      const rowRegex = /<w:tr\b[\s\S]*?<\/w:tr>/g;
      let trMatch: RegExpExecArray | null;

      while ((trMatch = rowRegex.exec(tableContent)) !== null) {
        const rowXml = trMatch[0];
        const cellRegex = /<w:tc\b[\s\S]*?<\/w:tc>/g;
        const cells: string[] = [];
        let tcMatch: RegExpExecArray | null;

        while ((tcMatch = cellRegex.exec(rowXml)) !== null) {
          const cellXml = tcMatch[0];
          const pMatches = cellXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [cellXml];
          const pTexts = pMatches
            .map((p) => {
              const textMatches = p.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
              return textMatches.map((t) => t.replace(/<[^>]+>/g, '')).join('').trim();
            })
            .filter(Boolean);
          const cellText = pTexts.join(' · ');
          cells.push(cleanXmlString(cellText));
        }

        if (cells.length >= 2) {
          // Check if this is a header row (e.g. Week, Topic, Coverage)
          const firstCell = cells[0].toLowerCase();
          const secondCell = cells[1].toLowerCase();
          if (
            firstCell.includes('week') ||
            firstCell.includes('topic') ||
            firstCell.includes('unit') ||
            secondCell.includes('topic') ||
            secondCell.includes('learning') ||
            secondCell.includes('coverage')
          ) {
            continue;
          }

          let topicTitle = '';
          let candidateCells: string[] = [];

          // If col 0 is week number and col 1 is topic
          if (/^\d+$/.test(cells[0]) || /^(?:week\s*\d+|wk\s*\d+)$/i.test(cells[0])) {
            topicTitle = cells[1] || '';
            candidateCells = cells.slice(2);
          } else {
            // Col 0 is topic, Col 1+ is subtopics
            topicTitle = cells[0];
            candidateCells = cells.slice(1);
          }

          if (topicTitle && topicTitle.length > 1 && !isCalendarMilestone(topicTitle)) {
            // Filter candidate cells to exclude methodology and reference citations
            const validSubtopicParts: string[] = [];
            for (const c of candidateCells) {
              if (isMethodologyOrActivity(c) || isReferenceCitation(c)) {
                continue;
              }
              // Split cell on dots or newlines or camelCase word boundaries
              const parts = c.split(/\s*[·;\n\r]\s*/).filter(Boolean);
              for (const part of parts) {
                if (!isMethodologyOrActivity(part) && !isReferenceCitation(part)) {
                  // Split on Title Case boundaries if subtopics were merged without delimiters
                  const subPhrases = splitJoinedSubtopics(part);
                  validSubtopicParts.push(...subPhrases);
                }
              }
            }

            const subTopics = validSubtopicParts.join(' · ');
            tableTopics.push({ topicTitle: cleanXmlString(topicTitle), subTopics });
          }
        }
      }
    }

    if (tableTopics.length >= 3) {
      return {
        unitCode,
        unitName,
        unitDescription,
        overallCompetencies,
        topics: tableTopics,
      };
    }

    // 4. Extract from Paragraphs / Numbered Lists if no table or table was small
    const paragraphs: string[] = [];
    const pRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(xml)) !== null) {
      const textMatches = pMatch[0].match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const pText = textMatches
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join(' ')
        .trim();
      const cleaned = cleanXmlString(pText);
      if (cleaned) {
        paragraphs.push(cleaned);
      }
    }

    const listTopics: { topicTitle: string; subTopics: string }[] = [];
    let currentTopic: { topicTitle: string; subTopicsList: string[] } | null = null;

    for (const line of paragraphs) {
      // Check if line starts with a number like "1.", "1.0", "Topic 1:", "Unit 1:"
      const topicMatch = line.match(/^(?:(?:Topic|Unit|Module|Week|Lesson)\s*\d+[:.-]|\d+[\.\)]\s*)(.+)/i);

      if (topicMatch) {
        if (currentTopic && !isCalendarMilestone(currentTopic.topicTitle)) {
          listTopics.push({
            topicTitle: currentTopic.topicTitle,
            subTopics: currentTopic.subTopicsList.join(' · '),
          });
        }

        const rawTitle = topicMatch[1].trim();
        const parts = rawTitle.split(/[:–—\-]\s*/);
        currentTopic = {
          topicTitle: parts[0].trim(),
          subTopicsList: parts.slice(1).filter(Boolean),
        };
      } else if (currentTopic) {
        // Subtopics / bullets
        const cleanSub = line.replace(/^[-*•·\d.)\s]+/, '').trim();
        if (cleanSub && cleanSub.length > 2 && !cleanSub.toLowerCase().includes('learning outcome')) {
          currentTopic.subTopicsList.push(cleanSub);
        }
      }
    }

    if (currentTopic && !isCalendarMilestone(currentTopic.topicTitle)) {
      listTopics.push({
        topicTitle: currentTopic.topicTitle,
        subTopics: currentTopic.subTopicsList.join(' · '),
      });
    }

    return {
      unitCode,
      unitName,
      unitDescription,
      overallCompetencies,
      topics: listTopics.length > 0 ? listTopics : tableTopics,
    };
  } catch (err) {
    console.error('Error parsing .docx syllabus:', err);
    throw new Error(err instanceof Error ? err.message : 'Could not parse Word document');
  }
}

function isCalendarMilestone(text: string): boolean {
  return /\b(cat(?:s)?|continuous\s+assessment\s+test|exam(?:ination)?s?|final\s+exam|revision|rat|readiness\s+assessment|holiday|break)\b/i.test(
    text
  );
}

function isMethodologyOrActivity(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    /^(interactive\s+)?(lecture|discussion|q\s*&\s*a|demonstration|field\s+visit|case\s+stud|hands-on|group\s+work|buzz\s+group|brainstorm|seminar|debate|role\s+play|field\s+trial|observation|peer\s+practice|practical\s+exercise|note-taking|workshop|tutorial|plenary)/i.test(
      lower
    ) ||
    /^(demonstrations?|practical\s+illustrations?|small\s+group|group\s+presentations?)/i.test(lower)
  );
}

function isReferenceCitation(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    /^(lehninger|harper|textbook|reference|edition|vol\.|ch\.|isbn|journal|manual|illustrated\s+biochemistry)/i.test(
      lower
    ) || /^\d+\.\s*(lehninger|harper|principles|illustrated)/i.test(lower)
  );
}

/**
 * Splits sentences or phrases merged without delimiters, e.g. "Importance of land preparation Methods of land preparation"
 */
function splitJoinedSubtopics(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Common keywords that start subtopics
  const regex = /(?<=[a-z0-9\)])\s+(?=(?:Importance|Requirements|Methods|Equipment|Land|Selection|Timing|Types|Preparation|Care|Common|Control|Harvesting|Post-harvest|Storage|Classes|Agronomical|Ecological|Principles|Adult|History|Organizational|Role|Community|Current|Challenges|Management|Prevention|Agricultural|Animal)\b)/g;

  const parts = trimmed.split(regex).map((p) => p.trim()).filter((p) => p.length > 2);
  return parts.length > 0 ? parts : [trimmed];
}
