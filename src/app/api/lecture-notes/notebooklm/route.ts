// ============================================================
// Lecture Notes — NotebookLM Companion Bridge API
// GET /api/lecture-notes/notebooklm?unitId=...&download=1
// ============================================================

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getCourseOutlineContext, getLectureMaterialsForUnit } from '@/features/lecture-notes/queries';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireTrainerAccess();
    const { searchParams } = new URL(req.url);
    const unitId = searchParams.get('unitId');
    const isDownload = searchParams.get('download') === '1' || searchParams.get('download') === 'true';

    if (!unitId) {
      return NextResponse.json({ error: 'unitId is required.' }, { status: 400 });
    }

    const db = await createClient();
    const { data: unit, error: unitError } = await db
      .from('units')
      .select('code, name')
      .eq('id', unitId)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Unit not found.' }, { status: 404 });
    }

    const unitCode = unit.code;
    const unitName = unit.name;

    const [outline, materials] = await Promise.all([
      getCourseOutlineContext(unitId),
      getLectureMaterialsForUnit(unitId),
    ]);

    const readyMaterials = materials.filter((m) =>
      Boolean(
        (m.ingestedAt || (m as unknown as { ingested_at?: string }).ingested_at) &&
        (m.contentText?.trim() || (m as unknown as { content_text?: string }).content_text?.trim())
      )
    );

    const outcomes = outline?.learningOutcomes ?? [];
    const outcomesText = outcomes.length > 0
      ? outcomes.map((o, i) => `${i + 1}. ${o}`).join('\n')
      : '(No formal learning outcomes found in course outline. Refer to source texts.)';

    const weeklyPlanText = outline?.weeklyPlanText?.trim() || '(No weekly plan details provided in course outline.)';

    const masterPrompt = [
      `You are an expert TVET Curriculum Specialist and Senior Medical & Nutrition Lecturer at Imperial College of Medical & Health Sciences.`,
      ``,
      `Using the uploaded reference documents and curriculum context for ${unitCode} — ${unitName}, generate comprehensive, classroom-ready lecture notes.`,
      ``,
      `CRITICAL INSTRUCTIONS:`,
      `1. Ground your synthesis strictly in the uploaded course outline and source texts.`,
      `2. Remove redundant or repeated passages across different source versions and synthesize common concepts.`,
      `3. Structure the notes adhering strictly to the TVET template:`,
      `   # [Topic Title]`,
      `   **${unitCode}: ${unitName} | TVET Lecture Notes**`,
      ``,
      `   ## Session Overview & Learning Outcomes`,
      `   Provide specific, competency-based learning outcomes aligned with TVET standards.`,
      ``,
      `   ## Key Terminology & Definitions`,
      `   Include precise scientific, medical, and clinical definitions.`,
      ``,
      `   ## Detailed Lecture Content`,
      `   Organize into logically sequenced numbered sections and ### subheadings. Include comparative tables, exact formulas with defined variables, and step-by-step procedures.`,
      ``,
      `   ## Practical Applications & Kenyan Context`,
      `   Include relevant Kenyan public health, community nutrition, and clinical examples present in the sources.`,
      ``,
      `   ## Trainer Delivery & Classroom Guide`,
      `   Key teaching emphasis, common learner misconceptions, and interactive discussion prompts.`,
      ``,
      `   ## Formative Assessment & Review Questions`,
      `   KNEC/CDACC-style MCQs with rationale, structured questions with marking points, and calculation/application problems.`,
      ``,
      `   ## Recommended References`,
      `   List references cited or supported by the source materials.`,
      ``,
      `4. Do not summarize files individually. Produce one cohesive, high-quality teaching document.`,
    ].join('\n');

    const bundleParts: string[] = [
      `================================================================================`,
      `OFFICIAL TVET CURRICULUM CONTEXT`,
      `UNIT: ${unitCode} — ${unitName}`,
      `================================================================================\n`,
      `APPROVED LEARNING OUTCOMES:`,
      outcomesText,
      `\nWEEKLY SYLLABUS PLAN:`,
      weeklyPlanText,
      `\n================================================================================`,
      `INGESTED REFERENCE SOURCES (${readyMaterials.length} ready file${readyMaterials.length === 1 ? '' : 's'})`,
      `================================================================================\n`,
    ];

    if (readyMaterials.length === 0) {
      bundleParts.push('(No ready source materials were ingested for this unit yet.)\n');
    } else {
      readyMaterials.forEach((m, idx) => {
        const rawContent = m.contentText || (m as unknown as { content_text?: string }).content_text || '';
        const filename = m.originalFilename ? ` | File: ${m.originalFilename}` : '';
        bundleParts.push(
          `===== SOURCE ${idx + 1}: ${m.title}${filename} =====\n`,
          rawContent.trim(),
          `\n===== END SOURCE ${idx + 1} =====\n\n`
        );
      });
    }

    const bundleContent = bundleParts.join('\n');

    if (isDownload) {
      const safeFilename = `${unitCode.replace(/[^a-zA-Z0-9_-]/g, '_')}_NotebookLM_Source_Bundle.txt`;
      return new NextResponse(bundleContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
        },
      });
    }

    return NextResponse.json({
      unitCode,
      unitName,
      materialCount: readyMaterials.length,
      masterPrompt,
      downloadUrl: `/api/lecture-notes/notebooklm?unitId=${encodeURIComponent(unitId)}&download=1`,
    });
  } catch (err) {
    console.error('[lecture-notes/notebooklm]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to prepare NotebookLM bundle.' },
      { status: 500 }
    );
  }
}
