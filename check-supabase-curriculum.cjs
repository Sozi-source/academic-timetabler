#!/usr/bin/env node
/**
 * check-supabase-curriculum.js
 * ---------------------------------------------------------------------------
 * Cross-checks your LIVE Supabase `curriculum_document_versions` table
 * against the report.json produced by clean-course-outlines.js, and builds
 * a per-unit action plan: import, re-check, or leave alone.
 *
 * For each unit + document type (course_outline / scheme_of_work) it works
 * out one of:
 *   OK             - already has a real active version in Supabase, and it
 *                     doesn't match any known corruption/mismatch pattern.
 *                     Nothing to do.
 *   NEEDS IMPORT   - no active version exists yet (so the app is currently
 *                     falling back to the built-in default), and you DO have
 *                     a real source file for it in your collection.
 *   NO SOURCE YET  - no active version exists, and you don't have a source
 *                     file for it either. You'll need to track one down.
 *   RE-CHECK       - an active version exists, but its own text matches a
 *                     known corruption pattern from your app's own code, or
 *                     its stated unit name doesn't look like it belongs to
 *                     this unit (the exact kind of cross-contamination your
 *                     20260913 migration had to fix manually for Biochemistry
 *                     / Nutrition Epidemiology).
 *   ORPHAN SOURCE  - a file in your collection didn't match any unit in the
 *                     `units` table at all (different programme, code typo,
 *                     or the unit doesn't exist in the system yet).
 *
 * NOTHING IS GUESSED SILENTLY. The corruption regex is copied verbatim from
 * your own curriculum-content/queries.ts (isCorruptedText). Every count and
 * quote below is a direct read of your Supabase data or your report.json.
 *
 * USAGE
 *   npm install @supabase/supabase-js
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx \
 *   node check-supabase-curriculum.js /path/to/report.json [outputDir]
 *
 * You need the SERVICE ROLE key (Supabase dashboard > Project Settings >
 * API > service_role secret), not the anon key — curriculum_document_versions
 * is normally locked down to server-side access only. Never commit this key
 * or share it; run this only on your own machine.
 * ---------------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');

let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch {
  console.error('Missing dependency "@supabase/supabase-js". Run: npm install @supabase/supabase-js');
  process.exit(1);
}

const args = process.argv.slice(2);
const reportPath = args[0];
const outputDir = path.resolve(args[1] || './supabase-curriculum-check');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!reportPath) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node check-supabase-curriculum.js /path/to/report.json [outputDir]');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Reused, verbatim, from src/features/teaching-documents/curriculum-content/queries.ts
// ---------------------------------------------------------------------------

function isCorruptedText(text) {
  if (!text) return false;
  return (
    /crnail|\(fating|o'cd\)|time\s+ours|total\s+for\s+module|mcxlule|\.\.i\.oi/i.test(text) ||
    /\ufeff3\.1\.o/i.test(text)
  );
}

// ---------------------------------------------------------------------------
// Generalized name-mismatch check (same word-overlap idea used in
// clean-course-outlines.js, applied here to compare an active DB payload's
// own stated unit name against the system unit it is attached to).
// ---------------------------------------------------------------------------

function wordOverlap(a, b) {
  const wa = new Set((a || '').toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wb = new Set((b || '').toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return 1; // not enough signal either way — don't flag
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared / Math.min(wa.size, wb.size);
}

function normalizeKey(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Reading ${reportPath} ...`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const groups = report.groups || [];

  console.log('Connecting to Supabase ...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Fetching units ...');
  const { data: units, error: unitsErr } = await supabase
    .from('units')
    .select('id,code,name,is_active')
    .order('code', { ascending: true });
  if (unitsErr) throw new Error(`Failed to fetch units: ${unitsErr.message}`);

  console.log('Fetching active curriculum_document_versions ...');
  const { data: versions, error: versionsErr } = await supabase
    .from('curriculum_document_versions')
    .select('id,unit_id,document_type,status,source_type,source_file_name,payload,updated_at')
    .eq('status', 'active');
  if (versionsErr) throw new Error(`Failed to fetch curriculum_document_versions: ${versionsErr.message}`);

  console.log(`Fetched ${units.length} units and ${versions.length} active document versions.\n`);

  // Index active versions by unit_id + document_type
  const activeByUnitAndType = new Map();
  for (const v of versions) {
    activeByUnitAndType.set(`${v.unit_id}::${v.document_type}`, v);
  }

  // Index system units by normalized code, and keep a normalized-name list
  // for the fallback (name-only) matching path.
  const unitsByCode = new Map();
  for (const u of units) {
    const key = normalizeKey(u.code);
    if (key) unitsByCode.set(key, u);
  }

  function findSystemUnit(group) {
    // group.displayCode may be a real code OR a filename-derived name.
    const asCode = normalizeKey(group.displayCode);
    if (unitsByCode.has(asCode)) return { unit: unitsByCode.get(asCode), matchedBy: 'code' };

    // Fall back to name match against every unit.
    const groupName = group.candidates[0].extraction.unitName || group.displayCode;
    let best = null;
    let bestScore = 0;
    for (const u of units) {
      const score = wordOverlap(groupName, u.name);
      if (score > bestScore) {
        bestScore = score;
        best = u;
      }
    }
    if (best && bestScore >= 0.6) return { unit: best, matchedBy: 'name', confidence: bestScore };
    return null;
  }

  const results = [];
  const matchedGroupKeys = new Set();

  // First pass: find every (group -> system unit) match, but DON'T emit a
  // result yet. Multiple source-file groups can legitimately resolve to the
  // same real unit (e.g. one file matched by its own unit code, another by
  // name only) — if we emitted one result per group we'd double-count that
  // unit's slot. So we bucket by the actual (unit, documentType) slot first.
  const slotMatches = new Map(); // key: unitId::documentType -> [{ group, match }]
  for (const group of groups) {
    const match = findSystemUnit(group);
    if (!match) continue; // handled as an orphan below
    matchedGroupKeys.add(group.documentType + '::' + group.displayCode);
    const key = `${match.unit.id}::${group.documentType}`;
    if (!slotMatches.has(key)) slotMatches.set(key, []);
    slotMatches.get(key).push({ group, match });
  }

  for (const [, entries] of slotMatches) {
    const unit = entries[0].match.unit;
    const documentType = entries[0].group.documentType;

    // If more than one group claims this same slot, pick the single
    // highest-scoring candidate across all of them as "the" source file —
    // never merge their text — and note the collision so it can be
    // manually verified.
    entries.sort((a, b) => b.group.candidates[0].score - a.group.candidates[0].score);
    const chosen = entries[0];
    const winner = chosen.group.candidates[0].extraction;
    const match = chosen.match;

    const activeVersion = activeByUnitAndType.get(`${unit.id}::${documentType}`);

    let recommendation;
    let reasons = [];

    if (entries.length > 1) {
      reasons.push(
        `${entries.length} different source-file groups in your collection matched this same unit (${entries.map((e) => `"${e.group.displayCode}"`).join(', ')}) — using the highest-scoring one (\`${winner.virtualPath}\`); double-check the others aren't actually a different unit before discarding them.`,
      );
    }

    // Independent of DB state: does the source file's OWN extracted name
    // actually look like it belongs to the unit it's about to be filed
    // under? Catches a mislabeled "Unit Code:" line inside the document
    // itself (e.g. a file about "Nutrition in the lifespan" internally
    // stating the Biochemistry II unit code) BEFORE it ever reaches import,
    // not just after the fact like the active-version check below.
    const sourceNameOverlap = winner.unitName ? wordOverlap(winner.unitName, unit.name) : 1;
    const sourceLooksMismatched = winner.unitName && sourceNameOverlap < 0.3;

    if (sourceLooksMismatched) {
      recommendation = 'NAME MISMATCH';
      reasons.push(
        `Source file is grouped under ${unit.code} (${unit.name}) by its stated unit code, but the file itself is titled "${winner.unitName}" — this looks like the wrong unit code was typed into that document. Do not import until you confirm which unit it actually belongs to.`,
      );
    } else if (!activeVersion) {
      recommendation = 'NEEDS IMPORT';
      reasons.push('No active version in Supabase for this unit/document type — currently served by the built-in default.');
    } else {
      const payload = activeVersion.payload || {};
      const activeDesc = payload.unit?.unitDescription || payload.unitDescription || '';
      const activeName = payload.unit?.unitName || payload.unitName || '';
      const activeTopics = payload.content || [];
      const activeFirstTopic = activeTopics[0]?.topic || '';

      const corrupted =
        isCorruptedText(activeDesc) ||
        isCorruptedText(activeFirstTopic) ||
        activeTopics.some((t) => isCorruptedText(t.topic) || isCorruptedText(t.coverage));

      const nameOverlap = activeName ? wordOverlap(activeName, unit.name) : 1;
      const looksMismatched = activeName && nameOverlap < 0.3;

      if (corrupted || looksMismatched) {
        recommendation = 'RE-CHECK';
        if (corrupted) reasons.push('Active version text matches a known corruption pattern (garbled OCR-style text) from your app\'s own corruption check.');
        if (looksMismatched) reasons.push(`Active version's own stated unit name ("${activeName}") doesn't look related to "${unit.name}" — possible cross-contamination like the Biochemistry/Nutrition Epidemiology case fixed on 2026-09-13.`);
      } else {
        recommendation = 'OK';
      }
    }

    if (match.matchedBy === 'name' && recommendation !== 'OK') {
      reasons.push(`Matched to this system unit by name similarity only (no unit code found in the source file) — confirm "${unit.code} ${unit.name}" is correct before importing.`);
    }

    if (chosen.group.flags && chosen.group.flags.length > 0 && recommendation !== 'OK') {
      reasons.push(...chosen.group.flags.map((f) => `From cleanup report: ${f}`));
    }

    results.push({
      unitCode: unit.code,
      unitName: unit.name,
      documentType,
      recommendation,
      reasons,
      matchedBy: match.matchedBy,
      activeVersion: activeVersion
        ? { sourceType: activeVersion.source_type, sourceFile: activeVersion.source_file_name, updatedAt: activeVersion.updated_at, topicCount: (activeVersion.payload?.content || []).length }
        : null,
      cleanedSource: { filePath: winner.virtualPath, topicCount: winner.topics.length },
    });
  }

  // Units that have no active version AND no cleaned source at all
  for (const unit of units) {
    for (const docType of ['course_outline', 'scheme_of_work']) {
      const alreadyCovered = results.some((r) => r.unitCode === unit.code && r.documentType === docType);
      if (alreadyCovered) continue;
      const activeVersion = activeByUnitAndType.get(`${unit.id}::${docType}`);
      if (activeVersion) {
        const payload = activeVersion.payload || {};
        const activeDesc = payload.unit?.unitDescription || payload.unitDescription || '';
        const activeTopics = payload.content || [];
        const corrupted = isCorruptedText(activeDesc) || activeTopics.some((t) => isCorruptedText(t.topic) || isCorruptedText(t.coverage));
        results.push({
          unitCode: unit.code,
          unitName: unit.name,
          documentType: docType,
          recommendation: corrupted ? 'RE-CHECK' : 'OK',
          reasons: corrupted
            ? ['Active version text matches a known corruption pattern — but no replacement source file was found in your cleaned collection.']
            : [],
          matchedBy: null,
          activeVersion: { sourceType: activeVersion.source_type, sourceFile: activeVersion.source_file_name, updatedAt: activeVersion.updated_at, topicCount: activeTopics.length },
          cleanedSource: null,
        });
      } else {
        results.push({
          unitCode: unit.code,
          unitName: unit.name,
          documentType: docType,
          recommendation: 'NO SOURCE YET',
          reasons: ['No active version in Supabase, and no matching file found in your cleaned collection.'],
          matchedBy: null,
          activeVersion: null,
          cleanedSource: null,
        });
      }
    }
  }

  // Orphan source files: in your collection, but never matched to a system unit
  const orphans = groups.filter((g) => !matchedGroupKeys.has(g.documentType + '::' + g.displayCode));

  // ---- write outputs ----
  fs.mkdirSync(outputDir, { recursive: true });

  results.sort((a, b) => a.unitCode.localeCompare(b.unitCode) || a.documentType.localeCompare(b.documentType));

  const byRec = (r) => results.filter((x) => x.recommendation === r);
  const counts = {
    OK: byRec('OK').length,
    'NEEDS IMPORT': byRec('NEEDS IMPORT').length,
    'RE-CHECK': byRec('RE-CHECK').length,
    'NAME MISMATCH': byRec('NAME MISMATCH').length,
    'NO SOURCE YET': byRec('NO SOURCE YET').length,
    'ORPHAN SOURCE': orphans.length,
  };

  const lines = [];
  lines.push('# Supabase curriculum cross-check — action plan');
  lines.push('');
  lines.push(`Checked ${units.length} units × 2 document types against ${versions.length} active Supabase records and ${groups.length} cleaned source files.`);
  lines.push('');
  lines.push('| Status | Count | Meaning |');
  lines.push('|---|---|---|');
  lines.push(`| OK | ${counts.OK} | already correct in Supabase — leave alone |`);
  lines.push(`| NEEDS IMPORT | ${counts['NEEDS IMPORT']} | no version yet, you have a real file — upload it |`);
  lines.push(`| RE-CHECK | ${counts['RE-CHECK']} | version exists but looks corrupted/mismatched |`);
  lines.push(`| NAME MISMATCH | ${counts['NAME MISMATCH']} | source file's own title doesn't match the unit it's filed under — do NOT import yet |`);
  lines.push(`| NO SOURCE YET | ${counts['NO SOURCE YET']} | no version, no file found — go find/create one |`);
  lines.push(`| ORPHAN SOURCE | ${counts['ORPHAN SOURCE']} | file in your collection didn't match any system unit |`);
  lines.push('');

  for (const status of ['NAME MISMATCH', 'RE-CHECK', 'NEEDS IMPORT', 'NO SOURCE YET']) {
    const rows = byRec(status);
    lines.push(`## ${status} (${rows.length})`);
    lines.push('');
    for (const r of rows) {
      lines.push(`### ${r.unitCode} — ${r.unitName} (${r.documentType})`);
      for (const reason of r.reasons) lines.push(`- ${reason}`);
      if (r.cleanedSource) lines.push(`- Source file available: \`${r.cleanedSource.filePath}\` (${r.cleanedSource.topicCount} topics extracted)`);
      if (r.activeVersion) lines.push(`- Current active version: \`${r.activeVersion.sourceFile || '(no filename recorded)'}\`, uploaded ${r.activeVersion.updatedAt}, ${r.activeVersion.topicCount} topics`);
      lines.push('');
    }
  }

  lines.push(`## ORPHAN SOURCE — files with no matching system unit (${orphans.length})`);
  lines.push('');
  for (const g of orphans) {
    lines.push(`- **${g.displayCode}** (${g.documentType}) — \`${g.candidates[0].extraction.virtualPath}\``);
  }
  lines.push('');

  lines.push(`## OK — already correct, no action needed (${counts.OK})`);
  lines.push('');
  lines.push(byRec('OK').map((r) => `${r.unitCode} (${r.documentType})`).join(', ') || 'None');

  fs.writeFileSync(path.join(outputDir, 'action-plan.md'), lines.join('\n'));
  fs.writeFileSync(path.join(outputDir, 'action-plan.json'), JSON.stringify({ counts, results, orphans }, null, 2));

  console.log('Summary:');
  console.table(counts);
  console.log(`\nFull action plan written to: ${outputDir}/action-plan.md`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
