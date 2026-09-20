import ExcelJS from 'exceljs';
import { getAuthenticatedProfile } from '@/features/auth/queries';
import { createClient } from '@/lib/supabase/server';

const NAVY = 'FF17365D';
const WHITE = 'FFFFFFFF';
const LIGHT_GRAY = 'FFF8FAFC';
const BORDER_COLOR = 'FFE2E8F0';

function styleHeader(row: ExcelJS.Row) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: WHITE },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: NAVY },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: NAVY } },
      left: { style: 'thin', color: { argb: NAVY } },
      bottom: { style: 'medium', color: { argb: NAVY } },
      right: { style: 'thin', color: { argb: NAVY } },
    };
  });
}

function styleBodyRow(row: ExcelJS.Row, isEven: boolean) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = {
      name: 'Calibri',
      size: 10,
    };
    cell.alignment = {
      vertical: 'middle',
      wrapText: true,
    };
    if (isEven) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: LIGHT_GRAY },
      };
    }
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
  });
}

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Imperial College of Medical & Health Sciences';
  workbook.created = new Date();

  // Try to load active units for the current user's department
  let activeUnits: Array<{ code: string; name: string }> = [];

  try {
    const profile = await getAuthenticatedProfile();
    const supabase = await createClient();

    let query = supabase
      .from('units')
      .select('code, name')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (profile?.activeDepartmentId) {
      query = query.eq('department_id', profile.activeDepartmentId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      activeUnits = data;
    }
  } catch (err) {
    console.warn('Could not pre-populate active units in template:', err);
  }

  // 1. Instructions Sheet
  const instructionsSheet = workbook.addWorksheet('Instructions', {
    views: [{ showGridLines: true }],
  });
  instructionsSheet.columns = [{ width: 14 }, { width: 95 }];

  instructionsSheet.addRow(['INSTRUCTIONS', 'Official Bulk Course Outline Ingestion Template']);
  instructionsSheet.mergeCells('A1:B1');
  instructionsSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: WHITE } };
  instructionsSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  instructionsSheet.addRow([]);

  const instructions = [
    ['1. Units Sheet', 'Lists all units. If your units are pre-filled below, you can add or paste description, learning outcomes, and references.'],
    ['2. Topics Sheet', 'Add weekly delivery topics for each unit. Each row contains the Unit Code, Topic Title, and Sub-topics / Content.'],
    ['3. Automatic 14-Week Formatting', 'The Academic Planner engine automatically formats these topics into the official 14-week TVET layout and timetable calendar.'],
    ['4. Authoritative Content', 'Content uploaded with this template will immediately become the official course outline, taking 100% precedence over any default or placeholder text.'],
    ['5. Sub-topics Formatting', 'Separate sub-topics using bullet points, dots (·), semicolons (;), or newlines.'],
  ];

  instructions.forEach(([step, desc]) => {
    const row = instructionsSheet.addRow([step, desc]);
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(2).font = { size: 10 };
  });

  // 2. Units Sheet
  const unitSheet = workbook.addWorksheet('Units', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });

  unitSheet.columns = [
    { header: 'Unit Code', key: 'unit_code', width: 16 },
    { header: 'Unit Name', key: 'unit_name', width: 34 },
    { header: 'Unit Description / Purpose', key: 'unit_description', width: 45 },
    { header: 'Summary of Learning Outcomes (Core Competencies)', key: 'core_learning_outcomes', width: 45 },
    { header: 'Teaching / Learning Approaches', key: 'teaching_learning_approaches', width: 35 },
    { header: 'Assessment Approaches & Weighting', key: 'assessment_approaches', width: 35 },
    { header: 'References & Textbooks', key: 'references_resources', width: 40 },
  ];
  styleHeader(unitSheet.getRow(1));

  if (activeUnits.length > 0) {
    activeUnits.forEach((u, idx) => {
      const row = unitSheet.addRow({
        unit_code: u.code,
        unit_name: u.name,
        unit_description: '',
        core_learning_outcomes: '',
        teaching_learning_approaches: 'Interactive lectures, guided class discussions, practical demonstrations.',
        assessment_approaches: 'Continuous Assessment Tests (CATs) · Practical Examinations · Final Summative Examination',
        references_resources: '',
      });
      styleBodyRow(row, idx % 2 === 1);
    });
  } else {
    const sampleRow = unitSheet.addRow({
      unit_code: 'DHN 2304',
      unit_name: 'Biochemistry II',
      unit_description: 'Equips learners with principles of biological chemistry, intermediate metabolism, enzyme catalysis, and bioenergetics.',
      core_learning_outcomes: '1. Demonstrate knowledge of biomolecular structures and enzymes.\n2. Explain cellular energy generation and metabolic pathways.',
      teaching_learning_approaches: 'Interactive lectures, guided class discussions, practical laboratory sessions.',
      assessment_approaches: 'Continuous Assessment Tests (CATs) · Final Summative Examination',
      references_resources: 'Textbook of Medical Biochemistry · Lehninger Principles of Biochemistry',
    });
    styleBodyRow(sampleRow, false);
  }

  // 3. Course Outline Topics Sheet
  const contentSheet = workbook.addWorksheet('Course Outline Topics', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });

  contentSheet.columns = [
    { header: 'Unit Code', key: 'unit_code', width: 16 },
    { header: 'Unit Name (Optional)', key: 'unit_name', width: 30 },
    { header: 'Sequence / Week', key: 'sequence', width: 16 },
    { header: 'Topic Title', key: 'topic', width: 40 },
    { header: 'Sub-topics / Specific Coverage', key: 'coverage', width: 60 },
    { header: 'Estimated Hours', key: 'hours', width: 16 },
    { header: 'References & Textbooks (Optional)', key: 'resources', width: 35 },
  ];
  styleHeader(contentSheet.getRow(1));

  // Sample topics for guidance
  const sampleTopics = [
    { code: 'DHN 2304', name: 'Biochemistry II', seq: 1, topic: 'Introduction to Biochemistry & Molecular Organization', coverage: 'Cellular chemical components · Chemical bonds · Water and aqueous solutions · pH and buffer systems', hours: 4, ref: 'Lehninger Ch. 1' },
    { code: 'DHN 2304', name: 'Biochemistry II', seq: 2, topic: 'Structure and Function of Carbohydrates', coverage: 'Monosaccharides · Disaccharides · Polysaccharides · Glycosidic bonds', hours: 4, ref: 'Lehninger Ch. 2' },
    { code: 'DHN 2304', name: 'Biochemistry II', seq: 3, topic: 'Lipids and Biological Membranes', coverage: 'Fatty acids · Triglycerides · Phospholipids · Membrane structure', hours: 4, ref: 'Lehninger Ch. 3' },
    { code: 'DHN 2304', name: 'Biochemistry II', seq: 4, topic: 'Amino Acids, Peptides and Proteins', coverage: 'Amino acid classification · Peptide bond · Protein structures', hours: 4, ref: 'Lehninger Ch. 4' },
    { code: 'DHN 2304', name: 'Biochemistry II', seq: 5, topic: 'Enzymes and Biocatalysis', coverage: 'Enzyme classification · Active sites · Enzyme kinetics · Factors affecting velocity', hours: 4, ref: 'Lehninger Ch. 5' },
    { code: 'DHN 2304', name: 'Biochemistry II', seq: 6, topic: 'Enzyme Regulation & Clinical Diagnostics', coverage: 'Inhibition · Allosteric regulation · Isoenzymes · Diagnostic enzymes', hours: 4, ref: 'Lehninger Ch. 6' },
  ];

  sampleTopics.forEach((item, index) => {
    const row = contentSheet.addRow({
      unit_code: item.code,
      unit_name: item.name,
      sequence: item.seq,
      topic: item.topic,
      coverage: item.coverage,
      hours: item.hours,
      resources: item.ref,
    });
    styleBodyRow(row, index % 2 === 1);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Authoritative_Course_Outline_Upload_Template.xlsx"',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
