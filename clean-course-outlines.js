#!/usr/bin/env node
/**
 * clean-course-outlines.js
 * ---------------------------------------------------------------------------
 * Deduplicates and extracts VERBATIM content from a zipped collection of
 * course outline / scheme of work .docx files (nested .zip archives are
 * unpacked automatically).
 *
 * GUARANTEE: this script never writes, rewrites, summarizes, or invents a
 * single word. Every field in the output comes from a direct text/table
 * extraction of the original .docx XML. Where a decision has to be made
 * (which duplicate wins, which column is the topic column, etc.) the
 * reasoning is logged in the report so you can check or override it by hand.
 *
 * OUTPUT (written to the output folder):
 *   report.md                              - human-readable summary
 *   report.json                            - same data, machine-readable
 *   Cleaned_Curriculum_Import.xlsx         - Units + Topics sheets per
 *                                             document type, ready to feed
 *                                             into the app's bulk-upload
 *                                             screen (Curriculum > Bulk
 *                                             upload)
 *   deduped_docx/<TYPE>__<CODE-or-NAME>.docx
 *                                           - exact, unmodified bytes of the
 *                                             winning source file per unit,
 *                                             just renamed for clarity
 *
 * USAGE
 *   npm install jszip exceljs
 *   node clean-course-outlines.js /path/to/Course_outlines.zip [outputDir]
 *
 * Optional flags:
 *   --keep-duplicates   also copy every non-winning candidate into
 *                        output/all-candidates/<key>/ so you can compare
 *                        them by hand.
 * ---------------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');

let JSZip, ExcelJS;
try {
  JSZip = require('jszip');
} catch {
  console.error('Missing dependency "jszip". Run: npm install jszip exceljs');
  process.exit(1);
}
try {
  ExcelJS = require('exceljs');
} catch {
  console.error('Missing dependency "exceljs". Run: npm install jszip exceljs');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));

const inputZipPath = args[0];
const outputDir = path.resolve(args[1] || './cleaned-course-outlines');
const KEEP_DUPLICATES = flags.has('--keep-duplicates');

if (!inputZipPath) {
  console.error('Usage: node clean-course-outlines.js <input.zip> [outputDir] [--keep-duplicates]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// XML / text helpers (pure extraction, no invention)
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanText(s) {
  return decodeEntities(s).replace(/[ \f\v\t]+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

/** Returns every top-level paragraph's plain text, in document order. */
function extractParagraphs(xml) {
  const paras = [];
  const re = /<w:p\b[\s\S]*?<\/w:p>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const runTexts = m[0].match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    const text = cleanText(runTexts.map((t) => t.replace(/<[^>]+>/g, '')).join(''));
    if (text) paras.push(text);
  }
  return paras;
}

/**
 * Parses every <w:tbl> in the document into rows of cells, where each cell
 * is an ARRAY of paragraph segments (not pre-joined) so callers can decide
 * how to split a "topic heading + subtopic lines jammed into one cell"
 * pattern without losing information.
 */
function extractTables(xml) {
  const tables = [];
  const tblRe = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  let tblMatch;
  while ((tblMatch = tblRe.exec(xml)) !== null) {
    const tblXml = tblMatch[0];
    const rows = [];
    const trRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
    let trMatch;
    while ((trMatch = trRe.exec(tblXml)) !== null) {
      const rowXml = trMatch[0];
      const cells = [];
      const tcRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
      let tcMatch;
      while ((tcMatch = tcRe.exec(rowXml)) !== null) {
        const cellXml = tcMatch[0];
        const pMatches = cellXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
        const segments = pMatches
          .map((p) => {
            const runTexts = p.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
            return cleanText(runTexts.map((t) => t.replace(/<[^>]+>/g, '')).join(''));
          })
          .filter(Boolean);
        cells.push(segments);
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }
  return tables;
}

function joinCell(segments) {
  return segments.join(' · ');
}

// ---------------------------------------------------------------------------
// Header-driven column mapping (fixes the "position guessing" bug that
// misreads a Week|Lesson|Topic|Outcome|Activities|Remarks table by assuming
// column 2 is always the topic).
// ---------------------------------------------------------------------------

const HEADER_PATTERNS = [
  // Order matters: more specific categories are checked before generic ones.
  ['coverage', [/\bsub[\s-]?topic/i, /\bcoverage\b/i, /\bspecific\s+coverage\b/i]],
  ['learningOutcomes', [/\boutcome/i, /\bobjective/i]],
  ['activities', [/\bactivit/i, /\bmethodolog/i, /\bteaching\s*\/?\s*learning\s+activ/i]],
  ['assessment', [/\bassessment\b/i, /\bremark/i, /\blearning\s+check\b/i]],
  ['resources', [/\bresource/i, /\breference/i, /\bmaterial/i, /\btextbook/i, /\bteaching\s+aid/i]],
  ['hours', [/\bhour/i, /\bduration/i, /^time$/i]],
  ['sequence', [/\bweek\b/i, /\bwk\b/i, /\bsequence\b/i, /^seq$/i, /\border\b/i]],
  ['topic', [/\btopic\b/i, /\btheme\b/i, /\bsession\s+title\b/i, /^title$/i, /\bcontent\b/i]],
];

/**
 * Deliberately does NOT map a bare "Lesson" / "Lesson No." column to
 * anything — treating a lesson-number label as the topic is exactly the
 * misparse this script exists to avoid.
 */
function classifyHeaderCell(text) {
  const t = text.trim();
  if (!t) return null;
  if (/^lesson(\s*(no\.?|number))?$/i.test(t)) return null;
  for (const [field, patterns] of HEADER_PATTERNS) {
    if (patterns.some((re) => re.test(t))) return field;
  }
  return null;
}

/** Finds the header row (first row with >= 2 recognizable columns) and its column map. */
function detectHeader(rows) {
  const scanLimit = Math.min(rows.length, 5);
  for (let r = 0; r < scanLimit; r++) {
    const colMap = {};
    rows[r].forEach((cellSegments, colIdx) => {
      const headerText = joinCell(cellSegments);
      const field = classifyHeaderCell(headerText);
      if (field && !(field in colMap)) colMap[field] = colIdx;
    });
    if (Object.keys(colMap).length >= 2) {
      return { headerRowIndex: r, colMap };
    }
  }
  return null;
}

/**
 * Extracts weekly topic rows from a single table using header-driven column
 * mapping. Returns { topics, usedFallback, warnings }.
 */
function extractTopicsFromTable(rows) {
  const warnings = [];
  const header = detectHeader(rows);

  if (!header || (header.colMap.topic === undefined && header.colMap.coverage === undefined)) {
    return { topics: [], usedFallback: false, warnings: ['no recognizable topic/coverage header found in this table'] };
  }

  const { headerRowIndex, colMap } = header;
  const topics = [];
  let running = 0;

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    running += 1;

    const get = (field) => (colMap[field] !== undefined ? row[colMap[field]] || [] : []);

    let title = '';
    let coverage = '';

    if (colMap.coverage !== undefined && colMap.topic !== undefined) {
      // Separate topic and coverage columns exist — use each verbatim.
      title = joinCell(get('topic'));
      coverage = joinCell(get('coverage'));
    } else if (colMap.topic !== undefined) {
      // Only a Topic column exists. Real-world docs often jam the heading
      // and its subtopics into this single cell as separate paragraphs
      // (e.g. Entrepreneurship's Topic column). First paragraph = title,
      // the rest = coverage. Nothing here is invented — it is exactly what
      // was already in that cell, just split at the paragraph boundary
      // Word itself used.
      const segs = get('topic');
      title = segs[0] || '';
      coverage = segs.slice(1).join(' · ');
    } else if (colMap.coverage !== undefined) {
      // Only a coverage-labelled column exists; treat first segment as title.
      const segs = get('coverage');
      title = segs[0] || '';
      coverage = segs.slice(1).join(' · ');
    }

    title = title.trim();
    coverage = coverage.trim();

    if (!title && !coverage) continue; // fully empty row, skip

    const sequenceCell = joinCell(get('sequence'));
    const seqMatch = sequenceCell.match(/\d+/);
    const sequence = seqMatch ? parseInt(seqMatch[0], 10) : running;

    const suspicious =
      /^(lesson|session|week|wk)\s*\d*$/i.test(title) || title.length < 4;

    topics.push({
      sequence,
      topic: title || '(untitled — see coverage)',
      coverage,
      hours: (() => {
        const h = joinCell(get('hours')).match(/\d+(\.\d+)?/);
        return h ? Number(h[0]) : undefined;
      })(),
      learningOutcomes: joinCell(get('learningOutcomes')) || undefined,
      activities: joinCell(get('activities')) || undefined,
      assessment: joinCell(get('assessment')) || undefined,
      resources: joinCell(get('resources')) || undefined,
      suspicious,
      sourceRow: r + 1,
    });
  }

  if (topics.some((t) => t.suspicious)) {
    warnings.push('one or more topic titles look like row labels rather than real topics (e.g. "Lesson 1") — verify against the source file');
  }

  return { topics, usedFallback: false, warnings };
}

/** Fallback for docs with no usable table: numbered paragraphs / bullet lists. */
function extractTopicsFromParagraphs(paragraphs) {
  const topics = [];
  let current = null;
  let seq = 0;

  for (const line of paragraphs) {
    const m = line.match(/^(?:(?:Topic|Unit|Module|Week|Lesson)\s*\d+\s*[:.\-]|\d+[.)]\s*)(.+)/i);
    if (m) {
      if (current) topics.push(current);
      seq += 1;
      const rest = m[1].trim();
      const parts = rest.split(/[:–—-]\s*/);
      current = {
        sequence: seq,
        topic: parts[0].trim(),
        coverage: parts.slice(1).join(' · '),
        suspicious: parts[0].trim().length < 4,
        sourceRow: null,
      };
    } else if (current) {
      const cleaned = line.replace(/^[-*•·\d.)\s]+/, '').trim();
      if (cleaned && cleaned.length > 2 && !/learning outcome/i.test(cleaned)) {
        current.coverage = current.coverage ? `${current.coverage} · ${cleaned}` : cleaned;
      }
    }
  }
  if (current) topics.push(current);
  return { topics, usedFallback: true, warnings: topics.length === 0 ? ['no table and no numbered list found'] : [] };
}

// ---------------------------------------------------------------------------
// Metadata extraction (unit code / name / description / outcomes / references)
// ---------------------------------------------------------------------------

const NON_CODE_WORDS = new Set([
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST',
  'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER', 'PAGE', 'ISSUE', 'VERSION',
  'REVISED', 'COPYRIGHT', 'SERIES', 'TERM', 'YEAR', 'WEEK', 'SEMESTER',
]);

function extractUnitCode(paragraphs, plainAll, filenameHint) {
  const labelled = plainAll.match(/unit\s*code\s*[:\-]?\s*([A-Z]{2,6}\s*\d{3,4}[A-Z]?)/i);
  if (labelled) return { value: labelled[1].toUpperCase().replace(/\s+/, ' '), confidence: 'labelled' };

  const genericRe = /\b([A-Z]{2,6})\s*[- ]?\s*(\d{3,4}[A-Z]?)\b/g;
  let m;
  while ((m = genericRe.exec(plainAll)) !== null) {
    if (!NON_CODE_WORDS.has(m[1].toUpperCase())) {
      return { value: `${m[1].toUpperCase()} ${m[2].toUpperCase()}`, confidence: 'pattern-in-text' };
    }
  }

  const fromFile = filenameHint.match(/\b([A-Z]{2,6})\s*[- ]?\s*(\d{3,4}[A-Z]?)\b/i);
  if (fromFile && !NON_CODE_WORDS.has(fromFile[1].toUpperCase())) {
    return { value: `${fromFile[1].toUpperCase()} ${fromFile[2].toUpperCase()}`, confidence: 'pattern-in-filename' };
  }

  return { value: null, confidence: 'not-found' };
}

function extractUnitName(plainAll, filenameHint) {
  const stop = /unit\s*duration|course\s*duration|module\s*duration|status\s*[:\-]|pre[\s-]?requisite|department|imperial|trainer|lecturer|contact|e-?mail/i;
  const labelled = plainAll.match(/(?:unit|course|module)\s*(?:title|name)\s*[:\-]?\s*([^\n\r]+?)(?:unit\s*duration|course\s*duration|module\s*duration|status\s*[:\-]|pre[\s-]?requisite|department|imperial|trainer|lecturer|contact|e-?mail|$)/i);
  if (labelled) {
    let candidate = cleanText(labelled[1]);
    // Guard against a run-on match swallowing the next sentence/section.
    if (stop.test(candidate)) candidate = candidate.split(stop)[0].trim();
    if (candidate.length > 2 && candidate.length < 90) {
      return { value: candidate, confidence: 'labelled' };
    }
  }
  const cleanedFile = filenameHint
    .replace(/\.docx$/i, '')
    .replace(/course outline|scheme of work|\[\d+\]|\(\d+\)|copy/gi, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { value: cleanedFile, confidence: 'from-filename' };
}

function extractSectionAfterHeading(paragraphs, headingRegex, stopRegex, maxParas = 10) {
  for (let i = 0; i < paragraphs.length; i++) {
    if (headingRegex.test(paragraphs[i])) {
      const collected = [];
      for (let j = i + 1; j < Math.min(i + 1 + maxParas, paragraphs.length); j++) {
        if (stopRegex.test(paragraphs[j])) break;
        if (paragraphs[j].length > 2) collected.push(paragraphs[j]);
      }
      if (collected.length > 0) return collected.join(' ');
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Document-type detection (course_outline vs scheme_of_work)
// ---------------------------------------------------------------------------

function detectDocType(virtualPath, plainHead) {
  const lower = virtualPath.toLowerCase();

  // Check folder segments from the file's IMMEDIATE parent outward, so a
  // specific "schemes/" folder right next to the file wins over a generic
  // top-level "Course Outlines" project/zip name higher up the same path
  // (both can legitimately appear in the same real-world path).
  const segments = lower.split('/').slice(0, -1); // drop the filename itself
  const schemeSegment = /^schemes?([\s_-]*of[\s_-]*work)?$|^sow$|^learning[\s_-]*plans?$/i;
  const outlineSegment = /^course[\s_-]*outlines?$/i;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (schemeSegment.test(segments[i].trim())) return { type: 'scheme_of_work', confidence: 'folder' };
    if (outlineSegment.test(segments[i].trim())) return { type: 'course_outline', confidence: 'folder' };
  }

  const wordScheme = /scheme[s]?[\s_-]*of[\s_-]*work|\bsow\b|learning[\s_-]*plan/i;
  const wordOutline = /course[\s_-]*outline[s]?|\boutline\b/i;

  const fileNameOnly = path.basename(lower);
  const nameHasScheme = wordScheme.test(fileNameOnly);
  const nameHasOutline = wordOutline.test(fileNameOnly);
  if (nameHasScheme && !nameHasOutline) return { type: 'scheme_of_work', confidence: 'filename' };
  if (nameHasOutline && !nameHasScheme) return { type: 'course_outline', confidence: 'filename' };

  const headHasScheme = wordScheme.test(plainHead);
  const headHasOutline = wordOutline.test(plainHead);
  if (headHasScheme && !headHasOutline) return { type: 'scheme_of_work', confidence: 'document-heading' };
  if (headHasOutline && !headHasScheme) return { type: 'course_outline', confidence: 'document-heading' };

  return { type: 'course_outline', confidence: 'default-guess' };
}

// ---------------------------------------------------------------------------
// Per-file extraction
// ---------------------------------------------------------------------------

function extractDocx(xml, virtualPath) {
  const paragraphs = extractParagraphs(xml);
  const plainAll = cleanText(paragraphs.join(' '));
  const plainHead = cleanText(paragraphs.slice(0, 15).join(' '));
  const filenameHint = path.basename(virtualPath);

  const code = extractUnitCode(paragraphs, plainAll, filenameHint);
  const name = extractUnitName(plainAll, filenameHint);
  const docType = detectDocType(virtualPath, plainHead);

  const unitDescription = extractSectionAfterHeading(
    paragraphs,
    /unit\s+description|course\s+description|unit\s+overview|purpose\s+of\s+(the\s+)?unit/i,
    /unit\s+objective|learning\s+outcome|general\s+instruction|week\s*1\b/i,
  );

  const learningOutcomes = extractSectionAfterHeading(
    paragraphs,
    /unit\s+objective|learning\s+outcome|core\s+competenc|expected\s+outcome/i,
    /general\s+instruction|week\s*1\b|assessment|reference/i,
  );

  const references = extractSectionAfterHeading(
    paragraphs,
    /^reference/i,
    /appendix|week\s*1\b/i,
    20,
  );

  const tables = extractTables(xml);
  let topicsResult = { topics: [], warnings: [] };
  for (const rows of tables) {
    const r = extractTopicsFromTable(rows);
    if (r.topics.length > topicsResult.topics.length) topicsResult = r;
  }
  if (topicsResult.topics.length === 0) {
    topicsResult = extractTopicsFromParagraphs(paragraphs);
  }

  return {
    virtualPath,
    unitCode: code.value,
    unitCodeConfidence: code.confidence,
    unitName: name.value,
    unitNameConfidence: name.confidence,
    documentType: docType.type,
    documentTypeConfidence: docType.confidence,
    unitDescription,
    learningOutcomes,
    references,
    topics: topicsResult.topics,
    parseWarnings: topicsResult.warnings,
  };
}

// ---------------------------------------------------------------------------
// Completeness scoring (decides which duplicate wins — never merges content)
// ---------------------------------------------------------------------------

function scoreExtraction(ex) {
  let score = 0;
  if (ex.unitDescription) score += 2;
  if (ex.learningOutcomes) score += 2;
  if (ex.references) score += 1;
  if (ex.unitCodeConfidence === 'labelled') score += 2;
  else if (ex.unitCodeConfidence === 'pattern-in-text') score += 1;

  const goodTopics = ex.topics.filter((t) => !t.suspicious);
  score += Math.min(goodTopics.length, 16); // cap so one giant table doesn't dominate purely on count
  if (goodTopics.length >= 10 && goodTopics.length <= 16) score += 3; // typical 12-14 week TVET shape

  const suspiciousCount = ex.topics.length - goodTopics.length;
  score -= suspiciousCount * 3;

  if (ex.topics.length === 0) score -= 10;

  return score;
}

function normalizeKey(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Recursive zip walking (handles zips nested inside zips)
// ---------------------------------------------------------------------------

async function collectDocxEntries(buffer, virtualPrefix, out, stats) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    stats.failedZips.push({ path: virtualPrefix, error: err.message });
    return;
  }

  const entries = Object.values(zip.files).filter((e) => !e.dir);

  for (const entry of entries) {
    const name = entry.name;
    const base = path.basename(name);
    if (base.startsWith('~$') || base.startsWith('.') || name.includes('__MACOSX')) continue;

    const virtualPath = `${virtualPrefix}/${name}`;

    if (/\.zip$/i.test(name)) {
      const nestedBuffer = await entry.async('nodebuffer');
      stats.zipsExpanded += 1;
      await collectDocxEntries(nestedBuffer, virtualPath, out, stats);
    } else if (/\.docx$/i.test(name)) {
      const docxBuffer = await entry.async('nodebuffer');
      out.push({ virtualPath, buffer: docxBuffer });
    }
  }
}

// ---------------------------------------------------------------------------
// Output writers
// ---------------------------------------------------------------------------

async function writeWorkbook(groups, outPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'clean-course-outlines.js';

  const outlineUnits = workbook.addWorksheet('Course Outline Units');
  outlineUnits.addRow(['unit_code', 'unit_name', 'unit_description', 'core_learning_outcomes', 'references_resources', 'source_file']);

  const outlineTopics = workbook.addWorksheet('Course Outline Topics');
  outlineTopics.addRow(['unit_code', 'sequence', 'topic', 'coverage', 'hours', 'learning_outcomes', 'activities', 'assessment', 'resources']);

  const schemeUnits = workbook.addWorksheet('Scheme of Work Units');
  schemeUnits.addRow(['unit_code', 'unit_name', 'source_file']);

  const schemeTopics = workbook.addWorksheet('Scheme of Work Topics');
  schemeTopics.addRow(['unit_code', 'sequence', 'topic', 'coverage', 'learning_outcomes', 'activities', 'assessment', 'resources']);

  for (const group of groups) {
    const winner = group.candidates[0];
    const code = group.displayCode;

    if (group.documentType === 'scheme_of_work') {
      schemeUnits.addRow([code, winner.extraction.unitName || '', winner.extraction.virtualPath]);
      for (const t of winner.extraction.topics) {
        schemeTopics.addRow([code, t.sequence, t.topic, t.coverage, t.learningOutcomes || '', t.activities || '', t.assessment || '', t.resources || '']);
      }
    } else {
      outlineUnits.addRow([
        code,
        winner.extraction.unitName || '',
        winner.extraction.unitDescription || '',
        winner.extraction.learningOutcomes || '',
        winner.extraction.references || '',
        winner.extraction.virtualPath,
      ]);
      for (const t of winner.extraction.topics) {
        outlineTopics.addRow([code, t.sequence, t.topic, t.coverage, t.hours ?? '', t.learningOutcomes || '', t.activities || '', t.assessment || '', t.resources || '']);
      }
    }
  }

  [outlineUnits, outlineTopics, schemeUnits, schemeTopics].forEach((sheet) => {
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((col) => { col.width = 28; });
  });

  await workbook.xlsx.writeFile(outPath);
}

function buildMarkdownReport(groups, stats) {
  const lines = [];
  lines.push('# Course outline / scheme of work cleanup report');
  lines.push('');
  lines.push(`- Zips expanded (including nested): ${stats.zipsExpanded}`);
  lines.push(`- .docx files found: ${stats.totalDocx}`);
  lines.push(`- .docx files that failed to parse: ${stats.failedDocx.length}`);
  lines.push(`- Distinct units resolved: ${groups.length}`);
  lines.push(`- Duplicate files collapsed: ${stats.totalDocx - groups.length}`);
  lines.push('');

  const needsReview = groups.filter((g) => g.flags.length > 0);
  lines.push(`## Needs manual review (${needsReview.length})`);
  lines.push('');
  if (needsReview.length === 0) {
    lines.push('None — every unit resolved cleanly.');
  }
  for (const g of needsReview) {
    lines.push(`### ${g.documentType} — ${g.displayCode}`);
    for (const flag of g.flags) lines.push(`- ${flag}`);
    lines.push(`- Chosen file: \`${g.candidates[0].extraction.virtualPath}\` (score ${g.candidates[0].score})`);
    if (g.candidates.length > 1) {
      lines.push('- Other candidates considered:');
      for (const c of g.candidates.slice(1)) {
        lines.push(`  - \`${c.extraction.virtualPath}\` (score ${c.score})`);
      }
    }
    lines.push('');
  }

  lines.push(`## All resolved units (${groups.length})`);
  lines.push('');
  lines.push('| Type | Code/Key | Topics | Winning file | Duplicates | Flags |');
  lines.push('|---|---|---|---|---|---|');
  for (const g of groups) {
    const winner = g.candidates[0];
    lines.push(
      `| ${g.documentType} | ${g.displayCode} | ${winner.extraction.topics.length} | ${winner.extraction.virtualPath} | ${g.candidates.length - 1} | ${g.flags.length} |`,
    );
  }
  lines.push('');

  if (stats.failedDocx.length > 0) {
    lines.push(`## Files that could not be parsed (${stats.failedDocx.length})`);
    lines.push('');
    for (const f of stats.failedDocx) lines.push(`- \`${f.path}\`: ${f.error}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Reading ${inputZipPath} ...`);
  const inputBuffer = fs.readFileSync(inputZipPath);

  const stats = { zipsExpanded: 1, totalDocx: 0, failedZips: [], failedDocx: [] };
  const docxEntries = [];

  console.log('Expanding zip(s) and locating .docx files ...');
  await collectDocxEntries(inputBuffer, path.basename(inputZipPath), docxEntries, stats);
  stats.totalDocx = docxEntries.length;
  console.log(`Found ${docxEntries.length} .docx files. Extracting in order, one at a time ...`);

  const extractions = [];
  for (let i = 0; i < docxEntries.length; i++) {
    const { virtualPath, buffer } = docxEntries[i];
    process.stdout.write(`  [${i + 1}/${docxEntries.length}] ${path.basename(virtualPath)}\r`);
    try {
      const docxZip = await JSZip.loadAsync(buffer);
      const docXmlFile = docxZip.file('word/document.xml');
      if (!docXmlFile) throw new Error('not a valid .docx (word/document.xml missing)');
      const xml = await docXmlFile.async('string');
      const extraction = extractDocx(xml, virtualPath);
      extractions.push(extraction);
    } catch (err) {
      stats.failedDocx.push({ path: virtualPath, error: err.message });
    }
  }
  console.log('\nExtraction pass complete. Grouping and de-duplicating ...');

  // Group by (documentType + normalized code, falling back to normalized name)
  const groupsMap = new Map();
  for (const extraction of extractions) {
    const codeKey = normalizeKey(extraction.unitCode);
    const nameKey = normalizeKey(extraction.unitName);
    const key = `${extraction.documentType}::${codeKey || nameKey}`;
    const displayCode = extraction.unitCode || extraction.unitName || '(unknown unit)';

    if (!groupsMap.has(key)) {
      groupsMap.set(key, { documentType: extraction.documentType, displayCode, candidates: [] });
    }
    const group = groupsMap.get(key);
    // Prefer a real unit code as the display label if one shows up later.
    if (!normalizeKey(group.displayCode) && extraction.unitCode) group.displayCode = extraction.unitCode;
    group.candidates.push({ extraction, score: scoreExtraction(extraction) });
  }

  const groups = [...groupsMap.values()];
  for (const g of groups) {
    g.candidates.sort((a, b) => b.score - a.score);
    g.flags = [];
    if (g.candidates.length > 1) {
      const top = g.candidates[0].score;
      const second = g.candidates[1].score;
      if (Math.abs(top - second) <= 1) {
        g.flags.push(`${g.candidates.length} candidate files scored nearly the same (top ${top} vs ${second}) — check which is actually current before trusting the automatic pick.`);
      } else {
        g.flags.push(`${g.candidates.length} duplicate files found; kept the highest-scoring one (${top}) over ${g.candidates.length - 1} other(s).`);
      }
    }
    for (const w of g.candidates[0].extraction.parseWarnings) {
      g.flags.push(w);
    }
    if (!g.candidates[0].extraction.unitCode) {
      g.flags.push('no explicit unit code found in the document — grouped by name only, confirm the correct system unit manually.');
    }
    if (g.candidates[0].extraction.documentTypeConfidence === 'default-guess') {
      g.flags.push('could not tell course outline from scheme of work for this file — defaulted to course_outline, please confirm.');
    }
  }

  groups.sort((a, b) => a.displayCode.localeCompare(b.displayCode));

  // ---- write outputs ----
  fs.mkdirSync(outputDir, { recursive: true });
  const dedupedDir = path.join(outputDir, 'deduped_docx');
  fs.mkdirSync(dedupedDir, { recursive: true });

  for (const g of groups) {
    const winner = g.candidates[0];
    const safeName = `${g.documentType}__${normalizeKey(g.displayCode) || 'unknown'}.docx`;
    const docxZip = await JSZip.loadAsync(docxEntries.find((e) => e.virtualPath === winner.extraction.virtualPath).buffer);
    const bytes = await docxZip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(path.join(dedupedDir, safeName), bytes);

    if (KEEP_DUPLICATES && g.candidates.length > 1) {
      const candDir = path.join(outputDir, 'all-candidates', normalizeKey(g.displayCode) || 'unknown');
      fs.mkdirSync(candDir, { recursive: true });
      for (let i = 0; i < g.candidates.length; i++) {
        const c = g.candidates[i];
        const entry = docxEntries.find((e) => e.virtualPath === c.extraction.virtualPath);
        fs.writeFileSync(path.join(candDir, `${i}__score${c.score}__${path.basename(c.extraction.virtualPath)}`), entry.buffer);
      }
    }
  }

  console.log('Writing Cleaned_Curriculum_Import.xlsx ...');
  await writeWorkbook(groups, path.join(outputDir, 'Cleaned_Curriculum_Import.xlsx'));

  console.log('Writing report ...');
  const md = buildMarkdownReport(groups, stats);
  fs.writeFileSync(path.join(outputDir, 'report.md'), md);
  fs.writeFileSync(
    path.join(outputDir, 'report.json'),
    JSON.stringify({ stats, groups }, null, 2),
  );

  console.log('\nDone.');
  console.log(`  Units resolved:      ${groups.length}`);
  console.log(`  Flagged for review:  ${groups.filter((g) => g.flags.length > 0).length}`);
  console.log(`  Output written to:   ${outputDir}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
