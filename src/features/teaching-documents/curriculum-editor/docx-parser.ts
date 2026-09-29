import { unpackZipBuffer } from '../zip-ingestion';
import { stripTopicFigures } from '../distribution-engine';
import {
  isAssessmentOrEvaluationItem,
  normalizeCurriculumSubtopics,
  normalizeCurriculumTopicTitle,
  serializeCurriculumSubtopics,
} from '../curriculum-content-normalizer';

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
export function parseDocxSyllabus(docxBuffer: Buffer, fileName?: string): ParsedDocxSyllabus {
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
    let unitCode = matchCode ? `${matchCode[1].toUpperCase()} ${matchCode[2].toUpperCase()}` : '';

    if (!unitCode && fileName) {
      const baseFilename = fileName.split('/').pop()?.split('\\').pop() ?? fileName;
      const codeMatch = baseFilename.match(codeRegex);
      if (codeMatch) {
        unitCode = `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
      }
    }

    // 2. Detect Unit Name / Title
    let unitName = '';
    const titleRegex = /(?:Unit|Course|Module)\s*(?:Title|Name)?\s*[:=-]\s*([^\n\r<]+)/i;
    const matchTitle = xml.match(titleRegex);
    if (matchTitle && matchTitle[1]) {
      unitName = cleanXmlString(matchTitle[1].replace(/<[^>]+>/g, ''));
    } else if (fileName) {
      const baseFilename = fileName.split('/').pop()?.split('\\').pop() ?? fileName;
      const stripped = baseFilename
        .replace(/\.docx$/i, '')
        .replace(/^(?:course\s*outline|scheme\s*of\s*work|sow)\s*[-_:]?\s*/i, '')
        .replace(/\b[A-Z]{2,6}\s*[0-9]{3,4}[A-Z]?\b/i, '')
        .replace(/^[-_:\s]+|[-_:\s]+$/g, '')
        .trim();
      if (stripped.length > 2) {
        unitName = stripped;
      }
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
        /learning\s+outcome|core\s+competenc|expected\s+outcome|competencies/i.test(lower) &&
        !/assessment|evaluation|grading|marking\s+scheme|mode\s+of\s+evaluation/i.test(lower)
      ) {
        // Collect the next few lines as competencies
        const lines: string[] = [];
        for (let j = i + 1; j < Math.min(i + 12, allParas.length); j++) {
          const candidate = allParas[j];
          if (
            /weekly\s+delivery|topical\s+breakdown|week\s+\d|teaching|assessment|evaluation|grading\s+system|marking\s+scheme|instructional\s+resources|references/i.test(
              candidate,
            )
          ) {
            break;
          }
          if (candidate.length > 5 && !isAssessmentOrEvaluationItem(candidate)) {
            // Also strip any trailing grading / assessment intros if present in candidate
            const cleanLine = candidate.replace(/\b(?:GRADING\s+SYSTEMS?|ASSESSMENT\s+WEIGHTING).*$/i, '').trim();
            if (cleanLine.length > 5 && !isAssessmentOrEvaluationItem(cleanLine)) {
              lines.push(cleanLine.replace(/^\d+[\.\)]\s*/, '').trim());
            }
          }
        }
        if (lines.length > 0 && !overallCompetencies) {
          overallCompetencies = lines.join('\n');
        }
      }
    }

    // 4. Extract Tables if present
    //
    // HARDENING (fixes the "week-range value mistaken for the topic title"
    // bug): column roles are now determined primarily by matching each
    // table's HEADER ROW text (e.g. "Week", "Topic", "Coverage") to known
    // field names, instead of guessing from the CONTENT of column 0. The
    // old approach broke whenever a week/sequence cell held anything other
    // than a bare integer -- e.g. a range like "1-2" spanning two weeks in
    // one row -- because it matched neither "digit" nor "Week N", so the
    // range text itself got stored as the topic title while the real topic
    // was demoted into subtopics.
    //
    // A universal plausibility check is applied as a last-resort safety
    // net on TOP of the header-driven mapping, so a bare number, range, or
    // "Week"/"Lesson" label can never end up stored as a topic title, even
    // for tables with no recognizable header row at all. Do not remove
    // this check when editing this function later -- it is the guard that
    // stops this exact class of bug from recurring.
    const HEADER_FIELD_PATTERNS: [string, RegExp[]][] = [
      ['coverage', [/\bsub[\s-]?topic/i, /\bcoverage\b/i, /\bspecific\s+coverage\b/i, /\bcontent\b/i]],
      ['learningOutcomes', [/\boutcome/i, /\bobjective/i]],
      ['activities', [/\bactivit/i, /\bmethodolog/i, /\bteaching\s*\/?\s*learning\s+activ/i]],
      ['assessment', [/\bassessment\b/i, /\bremark/i, /\blearning\s+check\b/i]],
      ['resources', [/\bresource/i, /\breference/i, /\bmaterial/i, /\btextbook/i, /\bteaching\s+aid/i]],
      ['hours', [/\bhour/i, /\bduration/i, /^time$/i]],
      ['sequence', [/\bweek/i, /\bwk\b/i, /\bsequence\b/i, /^seq$/i]],
      ['topic', [/\btopic\b/i, /\btheme\b/i, /^title$/i, /\bsession\s+title\b/i]],
    ];

    function classifyHeaderCell(text: string): string | null {
      const t = text.trim();
      if (!t) return null;
      // Never treat a bare "Lesson"/"Lesson No." label as the topic column
      // -- a lesson number is not a topic, and mistaking it for one is the
      // same failure mode this hardening pass exists to prevent.
      if (/^lesson(\s*(no\.?|number))?$/i.test(t)) return null;
      for (const [field, patterns] of HEADER_FIELD_PATTERNS) {
        if (patterns.some((re) => re.test(t))) return field;
      }
      return null;
    }

    function isPlausibleTopicTitle(text: string): boolean {
      const t = text.trim();
      if (!t) return false;
      // Reject bare numbers or ranges like "1", "1-2", "1,2", "1 & 2" --
      // these are week/sequence values, never real topic titles.
      if (/^\d+\s*(?:[-–—&,]\s*\d+)?$/.test(t)) return false;
      // Reject bare "Week 3", "Wk 4", "Lesson 2", "Session 1" style labels.
      if (/^(?:week|wk|lesson|session)\s*\d*$/i.test(t)) return false;
      // Reject document metadata and administrative header rows often found in Word tables
      if (
        /^(?:name\s+of\s+trainer|trainer(?:\s*name)?|instructor|institution|college|department|level|class|date\s+of\s+preparation|date\s+of\s+revision|revision\s+date|preparation\s+date|number\s+of\s+trainees|trainees\s+count|academic\s+year|term|intake|course\s+code|unit\s+code|unit\s+name|training\s+number)\s*[:=-]/i.test(t) ||
        /^(?:name\s+of\s+trainer|date\s+of\s+preparation|number\s+of\s+trainees|institution\s*:|level\s*:\s*\d|training\s+number\s*:)/i.test(t)
      ) {
        return false;
      }
      // Reject footer blocks, sign-offs, assessment weightings, and references captured from tables
      if (
        /^(?:teaching\s*\/?\s*learning|assessment\s+weighting|prescribed\s+references|instructional\s+equipment|trainer\s+sign-off|head\s+of\s+department|quality\s+assurance)\b/i.test(t)
      ) {
        return false;
      }
      // Require a minimum amount of actual alphabetic content.
      return t.replace(/[^a-zA-Z]/g, '').length >= 3;
    }

    const tableTopics: { topicTitle: string; subTopics: string }[] = [];
    const tableRegex = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
    let tblMatch: RegExpExecArray | null;

    while ((tblMatch = tableRegex.exec(xml)) !== null) {
      const tableContent = tblMatch[0];
      const rows: string[][] = [];
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
          // Preserve Word paragraph/list boundaries. Flattening these with a
          // middle-dot loses the distinction between separate subtopics and
          // allows Word's numbering/bullet formatting to leak into data.
          cells.push(cleanXmlString(pTexts.join('\n')));
        }

        if (cells.length >= 2) rows.push(cells);
      }

      if (rows.length === 0) continue;

      // --- Try header-driven column mapping first (scan up to 5 rows) ---
      const colMap: Record<string, number> = {};
      let headerRowIndex = -1;
      const scanLimit = Math.min(rows.length, 5);
      for (let r = 0; r < scanLimit; r++) {
        const candidateMap: Record<string, number> = {};
        rows[r].forEach((cellText, idx) => {
          const field = classifyHeaderCell(cellText);
          if (field && !(field in candidateMap)) candidateMap[field] = idx;
        });
        if (Object.keys(candidateMap).length >= 2) {
          Object.assign(colMap, candidateMap);
          headerRowIndex = r;
          break;
        }
      }

      const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

      for (let r = startRow; r < rows.length; r++) {
        const cells = rows[r];
        let topicTitle = '';
        let candidateCells: string[] = [];

        if (headerRowIndex >= 0 && (colMap.topic !== undefined || colMap.coverage !== undefined)) {
          // Header-driven: trust the column the header actually labelled
          // "Topic" (or, failing that, "Coverage"), regardless of what the
          // Week/Sequence column contains.
          const titleIdx = colMap.topic !== undefined ? colMap.topic : colMap.coverage;
          topicTitle = cells[titleIdx] || '';
          const excludedRoles = ['sequence', 'hours', 'learningOutcomes', 'activities', 'assessment', 'resources'];
          const excludedIdxs = new Set<number>([titleIdx, ...excludedRoles.map((role) => colMap[role]).filter((v) => v !== undefined)]);
          candidateCells = cells.filter((_, idx) => !excludedIdxs.has(idx));
        } else {
          // No usable header found -- fall back to the old position-based
          // heuristic, but now RANGE-AWARE: a week/sequence cell can be
          // "1", "1-2", "1,2" or "Week 3-4", not just a bare integer, so a
          // range no longer gets mistaken for the topic itself.
          const firstCellLower = (cells[0] || '').toLowerCase();
          const secondCellLower = (cells[1] || '').toLowerCase();
          if (
            firstCellLower.includes('week') ||
            firstCellLower.includes('topic') ||
            firstCellLower.includes('unit') ||
            secondCellLower.includes('topic') ||
            secondCellLower.includes('learning') ||
            secondCellLower.includes('coverage')
          ) {
            continue; // an actual header row that header-detection missed
          }

          const weekLike = /^(?:week|wk)?\s*\d+\s*(?:[-–—&,]\s*\d+)?$/i.test(cells[0]?.trim() || '');
          if (weekLike) {
            topicTitle = cells[1] || '';
            candidateCells = cells.slice(2);
          } else {
            topicTitle = cells[0];
            candidateCells = cells.slice(1);
          }
        }

        // --- Universal hardening net: never store an implausible title ---
        if (!isPlausibleTopicTitle(topicTitle)) {
          const fallbackCandidate = candidateCells.find((c) => isPlausibleTopicTitle(c));
          if (fallbackCandidate) {
            candidateCells = candidateCells.filter((c) => c !== fallbackCandidate);
            topicTitle = fallbackCandidate;
          } else {
            // Nothing plausible anywhere in this row -- skip it rather
            // than publish a garbage title like "1-2" or "Week 3".
            continue;
          }
        }

        if (topicTitle && topicTitle.length > 1) {
          // Filter candidate cells to exclude methodology/reference content, then
          // run every remaining value through the single canonical normalizer.
          // This removes Word bullets and numbering such as `1-2` and keeps one
          // curriculum point per physical line in storage.
          const validSubtopicParts: string[] = [];
          for (const c of candidateCells) {
            if (isMethodologyOrActivity(c) || isReferenceCitation(c)) continue;

            for (const part of normalizeCurriculumSubtopics(c)) {
              if (!isMethodologyOrActivity(part) && !isReferenceCitation(part)) {
                validSubtopicParts.push(part);
              }
            }
          }

          const subTopics = serializeCurriculumSubtopics(validSubtopicParts);
          tableTopics.push({ topicTitle: normalizeCurriculumTopicTitle(cleanXmlString(topicTitle)), subTopics });
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
        if (currentTopic) {
          listTopics.push({
            topicTitle: currentTopic.topicTitle,
            subTopics: serializeCurriculumSubtopics(currentTopic.subTopicsList),
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
        for (const cleanSub of normalizeCurriculumSubtopics(line)) {
          if (cleanSub.length > 2 && !cleanSub.toLowerCase().includes('learning outcome')) {
            currentTopic.subTopicsList.push(cleanSub);
          }
        }
      }
    }

    if (currentTopic) {
      listTopics.push({
        topicTitle: normalizeCurriculumTopicTitle(currentTopic.topicTitle),
        subTopics: serializeCurriculumSubtopics(currentTopic.subTopicsList),
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
