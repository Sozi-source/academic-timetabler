import ExcelJS from 'exceljs';

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
  row.height = 26;
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

  // 1. Primary Sheet: Syllabus Topics (No week numbers needed! System distributes them automatically)
  const contentSheet = workbook.addWorksheet('Course Outline Topics', {
    views: [{ showGridLines: true }],
  });

  contentSheet.columns = [
    { header: 'Unit Code', key: 'unit_code', width: 14 },
    { header: 'Unit Name', key: 'unit_name', width: 28 },
    { header: 'Topic Title', key: 'topic', width: 38 },
    { header: 'Sub-topics / Specific Coverage', key: 'coverage', width: 55 },
    { header: 'References & Textbooks (Optional)', key: 'resources', width: 35 },
  ];

  styleHeader(contentSheet.getRow(1));

  // Sample data: 10 Core Biochemistry Topics for DHN 2304
  const sampleTopics = [
    { topic: 'Introduction to Biochemistry & Molecular Organization', coverage: 'Cellular chemical components · Chemical bonds · Water and aqueous solutions · pH and buffer systems', ref: 'Lehninger Ch. 1 · Harper Ch. 1' },
    { topic: 'Structure and Function of Carbohydrates', coverage: 'Monosaccharides (aldoses/ketoses) · Disaccharides (sucrose, lactose, maltose) · Polysaccharides (starch, glycogen, cellulose) · Glycosidic bonds', ref: 'Lehninger Ch. 2' },
    { topic: 'Lipids and Biological Membranes', coverage: 'Fatty acids (saturated & unsaturated) · Triglycerides · Phospholipids · Cholesterol · Fluid mosaic membrane model', ref: 'Lehninger Ch. 3' },
    { topic: 'Amino Acids, Peptides and Proteins', coverage: 'Amino acid classification & zwitterions · Peptide bond formation · Primary, secondary, tertiary & quaternary protein structures', ref: 'Lehninger Ch. 4' },
    { topic: 'Enzymes and Biocatalysis', coverage: 'Enzyme classification · Active sites · Factors affecting enzyme velocity (pH, temperature, substrate) · Michaelis-Menten kinetics', ref: 'Lehninger Ch. 5' },
    { topic: 'Enzyme Regulation & Clinical Diagnostics', coverage: 'Reversible & irreversible inhibition · Allosteric regulation · Isoenzymes · Diagnostic significance of serum enzymes', ref: 'Lehninger Ch. 6' },
    { topic: 'Bioenergetics and ATP Generation', coverage: 'Free energy concept · High energy phosphates · Mitochondrial electron transport chain · Oxidative phosphorylation', ref: 'Lehninger Ch. 7' },
    { topic: 'Carbohydrate Metabolism: Glycolysis & TCA Cycle', coverage: 'Aerobic & anaerobic glycolysis · Pyruvate dehydrogenase complex · Citric acid cycle reactions & energy yield', ref: 'Lehninger Ch. 8' },
    { topic: 'Lipid Metabolism and Fatty Acid Oxidation', coverage: 'Fatty acid activation and transport · Beta-oxidation pathway · Ketone body synthesis & utilization · Lipogenesis overview', ref: 'Lehninger Ch. 9' },
    { topic: 'Amino Acid Catabolism and Urea Cycle', coverage: 'Transamination & oxidative deamination · Ammonia toxicity · Urea cycle steps and regulation · Clinical hyperammonemia', ref: 'Lehninger Ch. 10' },
  ];

  sampleTopics.forEach((item, index) => {
    const row = contentSheet.addRow({
      unit_code: 'DHN 2304',
      unit_name: 'Biochemistry II',
      topic: item.topic,
      coverage: item.coverage,
      resources: item.ref,
    });
    styleBodyRow(row, index % 2 === 1);
  });

  // 2. Unit Details Sheet (Optional Unit Description)
  const unitSheet = workbook.addWorksheet('Unit Overview', {
    views: [{ showGridLines: true }],
  });

  unitSheet.columns = [
    { header: 'Unit Code', key: 'unit_code', width: 14 },
    { header: 'Unit Name', key: 'unit_name', width: 28 },
    { header: 'Unit Description / Purpose', key: 'unit_description', width: 50 },
    { header: 'Overall Core Competencies', key: 'core_learning_outcomes', width: 50 },
  ];

  styleHeader(unitSheet.getRow(1));

  const unitRow = unitSheet.addRow({
    unit_code: 'DHN 2304',
    unit_name: 'Biochemistry II',
    unit_description: 'This unit equips learners with principles of biological chemistry, intermediate metabolism, enzyme catalysis, and bioenergetics required for clinical nutrition practice.',
    core_learning_outcomes: '1. Demonstrate knowledge of biomolecular structures and enzymes. 2. Explain cellular energy generation and metabolic pathways. 3. Apply biochemical concepts in nutritional assessment.',
  });
  styleBodyRow(unitRow, false);

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Course_Outline_Simplified_Template.xlsx"',
    },
  });
}
