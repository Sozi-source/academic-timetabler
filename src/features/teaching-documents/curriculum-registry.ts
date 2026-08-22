/**
 * TVET Curriculum Registry & Seed Ingestion Engine
 *
 * Allows real unit course outlines and schemes of work to be seeded,
 * automatically retrieved for trainers, and polished into the standard
 * 14-week TVET template format.
 */

export interface SeedWeeklyTopic {
  weekNumber: number;
  topicTitle: string;
  subTopics: string[];
  hours?: number;
  learningActivities?: string;
  resourcesAndReferences?: string;
  assessmentAndRemarks?: string;
  specificLearningOutcomes?: string;
}


export interface UnitCurriculumDefinition {
  /** Legacy ingestion tag retained for ZIP/import compatibility. */
  documentType?: 'course_outline' | 'scheme_of_work';
  unitCode: string;
  unitName: string;
  unitDescription?: string;
  overallCompetency?: string;
  learningOutcomes?: string[];
  weeklySchedule?: SeedWeeklyTopic[];
  references?: string[];
  instructionalEquipment?: string[];
  teachingLearningApproaches?: string;
  assessmentApproaches?: string;
}


/**
 * Normalizes a unit code for robust lookup (e.g. "CND 1101" -> "cnd1101")
 */
export function normalizeUnitCodeKey(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Built-in TVET Standard Curriculum Registry
 * Pre-seeded with institutional units across Nutrition, Clinical Medicine, Health Sciences, etc.
 */
export const TVET_CURRICULUM_REGISTRY: Record<string, UnitCurriculumDefinition> = {
  // 1. Human Anatomy & Physiology
  cnd1101: {
    unitCode: 'CND 1101',
    unitName: 'Human Anatomy and Physiology',
    unitDescription:
      'This unit covers the structural organisation and physiological mechanisms of the human body, providing essential foundational knowledge for clinical practice and nutritional therapeutics.',
    overallCompetency:
      'Demonstrate comprehensive knowledge of human body systems, anatomical structures, and physiological processes required for clinical diagnosis and nutritional management.',
    learningOutcomes: [
      'Describe the cellular structure, tissue organisation, and organ systems of the human body.',
      'Explain the anatomy and physiological functions of the cardiovascular and respiratory systems.',
      'Analyse the digestive, endocrine, and renal systems in relation to metabolism and nutrient absorption.',
      'Demonstrate proficiency in anatomical identification using anatomical models and laboratory specimens.',
      'Relate physiological mechanisms to pathophysiological states encountered in health care.',
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: 'Introduction to Human Anatomy, Body Organisation & Cellular Biology',
        subTopics: ['Anatomical terminology, planes, and cavities', 'Cell structure and membrane transport', 'Tissue classification'],
        learningActivities: 'Lectures, anatomical models inspection, microscopy slides study',
        resourcesAndReferences: 'Ross & Wilson Anatomy and Physiology in Health and Illness, Histology charts',
        assessmentAndRemarks: 'Formative oral review, labeling worksheet',
      },
      {
        weekNumber: 2,
        topicTitle: 'The Skeletal & Muscular Systems',
        subTopics: ['Axial and appendicular skeleton', 'Bone histology and ossification', 'Major muscle groups and mechanics'],
        learningActivities: 'Skeleton model identification, muscle palpation exercises',
        resourcesAndReferences: 'Human skeleton models, Anatomy atlas',
        assessmentAndRemarks: 'Practical identification quiz',
      },
      {
        weekNumber: 3,
        topicTitle: 'The Cardiovascular System (Blood & Heart Anatomy)',
        subTopics: ['Composition and functions of blood', 'Heart chambers, valves, and coronary circulation', 'Cardiac conduction system'],
        learningActivities: 'Heart dissection video, blood pressure measurement practice',
        resourcesAndReferences: 'Sphygmomanometers, stethoscopes, anatomical models',
        assessmentAndRemarks: 'Vital signs practical check',
      },
      {
        weekNumber: 4,
        topicTitle: 'Cardiovascular Dynamics & Blood Vessels',
        subTopics: ['Systemic and pulmonary circulation', 'Blood pressure regulation', 'Capillary exchange mechanisms'],
        learningActivities: 'Circulation pathways tracing, case studies on hypertension',
        resourcesAndReferences: 'Vascular charts, physiology manuals',
        assessmentAndRemarks: 'Short answer quiz, homework assignment',
      },
      {
        weekNumber: 5,
        topicTitle: 'Continuous Assessment 1 (RAT & Cardiovascular Review)',
        subTopics: ['Readiness Assessment Test (RAT 1)', 'Review of Assignments 1', 'Cardiovascular debrief'],
        learningActivities: 'Administering RAT 1, interactive group review',
        resourcesAndReferences: 'RAT question papers, marking rubrics',
        assessmentAndRemarks: 'Written RAT (15 Marks) & Assignment 1 grading (5 Marks)',
      },
      {
        weekNumber: 6,
        topicTitle: 'The Respiratory System',
        subTopics: ['Upper and lower respiratory tract anatomy', 'Mechanics of pulmonary ventilation', 'Gas exchange and transport'],
        learningActivities: 'Lung model demonstrations, spirometry lung volume measurements',
        resourcesAndReferences: 'Spirometer, lung charts, Guyton Medical Physiology',
        assessmentAndRemarks: 'Spirometry data interpretation worksheet',
      },
      {
        weekNumber: 7,
        topicTitle: 'The Digestive System & Gastrointestinal Tract',
        subTopics: ['Alimentary canal anatomy (mouth to rectum)', 'Accessory organs (liver, pancreas, gallbladder)', 'Digestion and absorption'],
        learningActivities: 'GI tract mapping, enzyme digestion simulations',
        resourcesAndReferences: 'Digestive system torso models, physiology workbooks',
        assessmentAndRemarks: 'GI tract process flow analysis',
      },
      {
        weekNumber: 8,
        topicTitle: 'Continuous Assessment 2 (Official Mid-Term CAT)',
        subTopics: ['Continuous Assessment Test (CAT)', 'CAT marking and individual performance review'],
        learningActivities: 'Supervised CAT examination, exam debrief',
        resourcesAndReferences: 'Official CAT exam booklets, invigilation sheets',
        assessmentAndRemarks: 'Official Mid-Term CAT (15 Marks)',
      },
      {
        weekNumber: 9,
        topicTitle: 'The Renal & Urinary System',
        subTopics: ['Kidney anatomy and nephron structure', 'Urine formation: filtration, reabsorption, secretion', 'Fluid-electrolyte balance'],
        learningActivities: 'Kidney dissection demonstration, urinalysis lab simulation',
        resourcesAndReferences: 'Kidney anatomical models, urinalysis test strips',
        assessmentAndRemarks: 'Renal function case questions',
      },
      {
        weekNumber: 10,
        topicTitle: 'The Endocrine & Nervous Systems (Integration & Presentations)',
        subTopics: ['Major endocrine glands and hormonal actions', 'Central and peripheral nervous system', 'Trainee Group Presentations'],
        learningActivities: 'Trainee case presentations on hormonal disorders',
        resourcesAndReferences: 'Endocrine charts, presentation scoring rubrics',
        assessmentAndRemarks: 'Trainee Presentation Evaluation (10 Marks)',
      },
      {
        weekNumber: 11,
        topicTitle: 'The Reproductive & Immune Systems',
        subTopics: ['Male and female reproductive anatomy', 'Innate and adaptive immunity', 'Lymphatic circulation'],
        learningActivities: 'Immunology interactive slides, discussion groups',
        resourcesAndReferences: 'Immunology reference guides, lymphatic torso',
        assessmentAndRemarks: 'Concept map assignment',
      },
      {
        weekNumber: 12,
        topicTitle: 'Comprehensive Practical Anatomical Review',
        subTopics: ['Multi-station practical identification', 'Integration of organ systems in clinical scenarios', 'Logbook sign-off'],
        learningActivities: 'OSPE station rounds, practical checklist verification',
        resourcesAndReferences: 'Specimen stations, practical manuals',
        assessmentAndRemarks: 'Formative practical assessment',
      },
      {
        weekNumber: 13,
        topicTitle: 'Course Synthesis, Revision & Final Examination Preparation',
        subTopics: ['Comprehensive syllabus review', 'KNEC/TVET past examination review', 'Examination guidelines and instructions'],
        learningActivities: 'Revision lecture, Q&A interactive seminar',
        resourcesAndReferences: 'Past TVET exam series, review question packs',
        assessmentAndRemarks: 'Mock exam practice',
      },
      {
        weekNumber: 14,
        topicTitle: 'End-of-Term Summative Assessment & Final Examinations',
        subTopics: ['Summative Examination (70%)', 'Departmental result compilation', 'Markbook submission'],
        learningActivities: 'Administering final examination paper',
        resourcesAndReferences: 'National examination papers, official answer sheets',
        assessmentAndRemarks: 'End-Term Examination (70 Marks) — Total 100%',
      },
    ],
    references: [
      'Waugh, A., & Grant, A. (2018). Ross & Wilson Anatomy and Physiology in Health and Illness. Elsevier.',
      'Hall, J. E. (2020). Guyton and Hall Textbook of Medical Physiology. Saunders.',
      'Kenya National Qualifications Authority (KNQA) TVET Curriculum Standards.',
    ],
    instructionalEquipment: [
      'Full-size articulated human skeleton and anatomical torso models.',
      'Compound light microscopes and prepared histology slides.',
      'Diagnostic toolkits: Sphygmomanometers, stethoscopes, spirometers.',
    ],
  },

  // 2. Principles of Human Nutrition
  nut101: {
    unitCode: 'NUT 101',
    unitName: 'Principles of Human Nutrition',
    unitDescription:
      'This unit introduces fundamental principles of nutritional science, macronutrients, micronutrients, energy balance, and dietary standards for human health across different lifecycle stages.',
    overallCompetency:
      'Evaluate nutrient requirements, assess dietary intake, and develop evidence-based nutritional recommendations conforming to national dietary guidelines.',
    learningOutcomes: [
      'Explain the classification, chemical properties, and biological functions of carbohydrates, proteins, and lipids.',
      'Describe the physiological roles, dietary sources, and deficiency/toxicity manifestations of vitamins and minerals.',
      'Calculate basal metabolic rate (BMR), total daily energy expenditure (TDEE), and nutrient density.',
      'Apply food composition tables and dietary reference intakes (DRIs) in meal planning.',
      'Formulate nutritional recommendations for varying physiological states (infancy, pregnancy, lactation, elderly).',
    ],
    references: [
      'Gibney, M. J., et al. (2019). Introduction to Human Nutrition. Wiley-Blackwell.',
      'Ministry of Health (MoH Kenya). Kenya National Food Composition Tables.',
      'World Health Organization (WHO) Dietary Guidelines.',
    ],
    instructionalEquipment: [
      'Food portion visual aids and measuring cylinders.',
      'Electronic digital dietary balances (0.1g accuracy).',
      'Food composition tables software and reference manuals.',
    ],
  },

  // 3. Diet Therapy
  cnd2101: {
    unitCode: 'CND 2101',
    unitName: 'Diet Therapy',
    unitDescription:
      'Focuses on medical nutrition therapy (MNT), pathophysiology, and therapeutic dietary modifications for clinical conditions including diabetes, hypertension, renal diseases, and gastrointestinal disorders.',
    overallCompetency:
      'Design, implement, and monitor medical nutrition therapy plans for hospitalized and outpatient clients with chronic and acute medical conditions.',
    learningOutcomes: [
      'Perform clinical nutrition assessments using ABCDE methodologies (Anthropometric, Biochemical, Clinical, Dietary, Ecological).',
      'Formulate therapeutic diet prescriptions for metabolic and endocrine disorders.',
      'Plan specialized enteral and parenteral nutrition regimens.',
      'Counsel patients effectively on therapeutic dietary adherence.',
      'Document clinical nutrition care plans compliant with medical records standards.',
    ],
    references: [
      'Mahan, L. K., & Raymond, J. L. (2021). Krause’s Food & the Nutrition Care Process. Elsevier.',
      'Kenya National Clinical Nutrition and Dietetics Guidelines.',
      'American Dietetic Association Nutrition Care Manual.',
    ],
    instructionalEquipment: [
      'Anthropometric equipment (Stadiometers, Seca weighing scales, MUAC tapes).',
      'Therapeutic food models and enteral feeding tubes/pumps demonstration kit.',
    ],
  },

  // 4. Agricultural Production & Agribusiness
  chn2309: {
    unitCode: 'CHN 2309',
    unitName: 'Agricultural Production',
    unitDescription:
      'This unit equips trainees with competencies in sustainable agricultural crop production, livestock husbandry, agro-ecological systems, soil and water management, post-harvest technologies, and farm economics.',
    overallCompetency:
      'Manage small-to-commercial agricultural enterprises, implement sustainable crop and livestock husbandry practices, and ensure post-harvest food security compliant with national agricultural standards.',
    learningOutcomes: [
      'Apply agro-ecological principles, soil science, and fertility management techniques for crop production.',
      'Implement good agronomic practices (GAP) for major food, horticultural, and industrial crops.',
      'Demonstrate sound livestock husbandry, feeds formulation, and disease management protocols.',
      'Design and operate farm water conservation, harvesting, and irrigation systems.',
      'Apply post-harvest preservation techniques, agricultural economics, and farm record-keeping.',
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: 'Introduction to Agricultural Production & Farming Systems in Kenya',
        subTopics: ['Overview of agricultural sectors & contribution to food security', 'Agro-ecological zones of Kenya', 'Farming systems classification'],
        learningActivities: 'Lectures, agro-ecological zone mapping, class discussion',
        resourcesAndReferences: 'Ministry of Agriculture Manual, Agricultural Atlas of Kenya',
        assessmentAndRemarks: 'Formative oral questions, assignment on local farming systems',
      },
      {
        weekNumber: 2,
        topicTitle: 'Soil Science, Land Preparation & Soil Fertility Management',
        subTopics: ['Soil physical and chemical properties', 'Soil sampling and testing protocols', 'Organic and inorganic fertilizers, composting & soil conservation'],
        learningActivities: 'Soil texture finger testing, compost heap preparation demonstration',
        resourcesAndReferences: 'Soil testing kits, farm tillage implements, compost materials',
        assessmentAndRemarks: 'Soil sampling practical report',
      },
      {
        weekNumber: 3,
        topicTitle: 'Crop Production Principles & Nursery Management',
        subTopics: ['Seed selection, germination testing, and dormancy', 'Nursery establishment and seedling management', 'Transplanting and vegetative propagation'],
        learningActivities: 'Seed germination assay, budding/grafting practicals',
        resourcesAndReferences: 'Seed varieties, nursery beds, potting bags, grafting knives',
        assessmentAndRemarks: 'Nursery establishment scorecard',
      },
      {
        weekNumber: 4,
        topicTitle: 'Plant Protection: Pests, Diseases & Weed Management',
        subTopics: ['Major crop insect pests and economic injury levels', 'Fungal, bacterial, and viral plant pathogens', 'Integrated Pest Management (IPM) & safe pesticide use'],
        learningActivities: 'Field pest scouting, sprayer calibration, weed specimen collection',
        resourcesAndReferences: 'Knapsack sprayers, PPE, pest specimen jars, herbarium sheets',
        assessmentAndRemarks: 'Pest identification practical quiz',
      },
      {
        weekNumber: 5,
        topicTitle: 'Continuous Assessment 1 (RAT 1 & Crop Science Review)',
        subTopics: ['Readiness Assessment Test (RAT 1)', 'Review of Crop Science practical assignments', 'Debrief and feedback session'],
        learningActivities: 'Administering RAT 1, interactive group review',
        resourcesAndReferences: 'RAT question papers, marking guides',
        assessmentAndRemarks: 'Written RAT (15 Marks) & Assignment 1 grading (5 Marks)',
      },
      {
        weekNumber: 6,
        topicTitle: 'Livestock Production & Animal Husbandry Principles',
        subTopics: ['Major livestock species (dairy cattle, poultry, small ruminants, swine)', 'Housing design and animal welfare standards', 'Livestock breeding, selection, and reproduction'],
        learningActivities: 'Farm unit walkthrough, housing dimension measurements',
        resourcesAndReferences: 'Livestock unit housing, animal health reference handbooks',
        assessmentAndRemarks: 'Housing design evaluation worksheet',
      },
      {
        weekNumber: 7,
        topicTitle: 'Animal Nutrition, Feeds Formulation & Pasture Management',
        subTopics: ['Nutrient requirements of farm animals', 'Feed ingredients, feed formulation, and ration balancing', 'Pasture establishment, forage conservation (silage & hay)'],
        learningActivities: 'Pearson square feed ration calculation, silage making demonstration',
        resourcesAndReferences: 'Feed formulation tables, silage drums, forage choppers',
        assessmentAndRemarks: 'Ration formulation calculation assignment',
      },
      {
        weekNumber: 8,
        topicTitle: 'Continuous Assessment 2 (Official Mid-Term CAT Examination)',
        subTopics: ['Supervised Mid-Term Continuous Assessment Test (CAT)', 'Mid-term practical logbook verification'],
        learningActivities: 'Supervised examination administration, logbook submission',
        resourcesAndReferences: 'Official CAT booklets, institutional exam invigilation sheets',
        assessmentAndRemarks: 'Official Mid-Term CAT (15 Marks)',
      },
      {
        weekNumber: 9,
        topicTitle: 'Agricultural Water Management & Irrigation Technologies',
        subTopics: ['Water sources, quality, and irrigation requirements', 'Drip, sprinkler, and surface irrigation systems', 'Rainwater harvesting and storage structures'],
        learningActivities: 'Drip kit assembly practical, discharge rate measurement',
        resourcesAndReferences: 'Drip irrigation kits, water pumps, flow meters',
        assessmentAndRemarks: 'Irrigation layout design project',
      },
      {
        weekNumber: 10,
        topicTitle: 'Post-Harvest Handling, Food Storage & Preservation',
        subTopics: ['Post-harvest loss causes and prevention strategies', 'Harvesting maturity indices for grains and horticultural produce', 'Grain storage, hermetic bags, cold chain management & agro-processing'],
        learningActivities: 'Moisture meter testing, hermetic storage demonstration',
        resourcesAndReferences: 'Moisture meters, hermetic storage bags, produce crates',
        assessmentAndRemarks: 'Post-harvest loss mitigation report',
      },
      {
        weekNumber: 11,
        topicTitle: 'Agricultural Economics, Farm Records & Agribusiness',
        subTopics: ['Farm budgeting, gross margin analysis, and cash flow', 'Types of farm records (production, financial, inventory)', 'Agricultural marketing, value chain addition, and cooperatives'],
        learningActivities: 'Gross margin spreadsheet modeling, farm record book setup',
        resourcesAndReferences: 'Farm record books, financial calculator, agribusiness case studies',
        assessmentAndRemarks: 'Trainee Agribusiness Plan Presentation (10 Marks)',
      },
      {
        weekNumber: 12,
        topicTitle: 'Integrated Farm Management & Field Competency Assessment',
        subTopics: ['Multi-enterprise farm integration (crop-livestock synergy)', 'Occupational safety and health (OSH) in agriculture', 'Practical skills verification & final logbook sign-off'],
        learningActivities: 'Comprehensive farm practical stations, logbook sign-off',
        resourcesAndReferences: 'Farm enterprise units, practical evaluation rubrics',
        assessmentAndRemarks: 'Final practical competency evaluation',
      },
      {
        weekNumber: 13,
        topicTitle: 'Course Synthesis, Comprehensive Revision & Examination Prep',
        subTopics: ['Comprehensive syllabus review across all 12 modules', 'National and institutional past examination review', 'Examination guidelines, rubrics, and answering techniques'],
        learningActivities: 'Revision seminar, Q&A interactive problem solving',
        resourcesAndReferences: 'Past examination papers, revision booklets',
        assessmentAndRemarks: 'Mock examination review',
      },
      {
        weekNumber: 14,
        topicTitle: 'Summative End-of-Term Final Examination',
        subTopics: ['Summative Examination (70%)', 'Departmental mark compilation and moderation', 'Final markbook submission'],
        learningActivities: 'Supervised final examination administration',
        resourcesAndReferences: 'Institutional examination papers, official answer sheets',
        assessmentAndRemarks: 'End-Term Final Examination (70 Marks) — Total 100%',
      },
    ],
    references: [
      'Ministry of Agriculture, Livestock and Fisheries (Kenya). Agricultural Training Handbook.',
      'Food and Agriculture Organization (FAO). Good Agricultural Practices Guidelines.',
      'Ngugi, D. N., et al. (2018). East African Agriculture: A Textbook for Colleges.',
    ],
    instructionalEquipment: [
      'Agricultural demonstration farm, nursery sheds, and greenhouse.',
      'Soil testing kits, moisture meters, and drip irrigation assemblies.',
      'Knapsack sprayers, farm tools, and Personal Protective Equipment (PPE).',
    ],
  },
};

/**
 * Generates a structured, non-repetitive 14-week progressive curriculum
 * when no pre-seeded or uploaded definition exists for a unit.
 */
function generateProgressiveWeeklySchedule(
  unitCode: string,
  unitName: string
): SeedWeeklyTopic[] {
  const weeklyFramework = [
    {
      week: 1,
      title: `Introduction, Scope & Foundational Principles of ${unitName}`,
      subs: [
        `Historical background, definitions, and scope of ${unitName}`,
        `Institutional and regulatory framework governing ${unitName}`,
        `Professional roles, ethics, and workplace competencies`,
      ],
      activity: 'Orientation lecture, interactive discussion, syllabus review',
      resources: `${unitName} Course Handbook, National Occupational Standards`,
      remarks: 'Diagnostic assessment & concept baseline survey',
    },
    {
      week: 2,
      title: `Theoretical Frameworks & Core Concepts in ${unitName}`,
      subs: [
        `Fundamental theories and scientific principles underlying ${unitName}`,
        `Classifications, terminology, and standard taxonomies`,
        `Relationship with multidisciplinary health and technical fields`,
      ],
      activity: 'Concept mapping, lecture, small-group analysis',
      resources: 'Reference textbooks, digital visual aids, anatomical/technical models',
      remarks: 'Formative concept check & short quiz',
    },
    {
      week: 3,
      title: `Methodologies, Tools & Standard Operating Procedures`,
      subs: [
        `Standard diagnostic/practical instruments and tools in ${unitName}`,
        `Standard Operating Procedures (SOPs) and safety protocols`,
        `Instrument calibration, handling, and maintenance routines`,
      ],
      activity: 'Practical tool demonstration, SOP review, laboratory/workshop setup',
      resources: 'Laboratory/workshop equipment, SOP reference sheets',
      remarks: 'Practical tool checklist assessment',
    },
    {
      week: 4,
      title: `Applied Techniques & Practical Process Execution`,
      subs: [
        `Step-by-step execution of primary workplace procedures`,
        `Data collection, recording, and documentation protocols`,
        `Quality control measures and error minimization`,
      ],
      activity: 'Hands-on practical session, simulation exercises, peer reviews',
      resources: 'Worksheets, practical kits, diagnostic consumables',
      remarks: 'Practical performance rubric grading',
    },
    {
      week: 5,
      title: `Continuous Assessment 1 (RAT 1 & Module Review)`,
      subs: [
        `Readiness Assessment Test (RAT 1) covering Weeks 1–4`,
        `Grading and debrief of Assignment 1`,
        `Remedial discussions on challenging topics`,
      ],
      activity: 'Supervised RAT administration, feedback seminar',
      resources: 'RAT question papers, grading rubrics, answer keys',
      remarks: 'Continuous Assessment 1 (RAT: 15 Marks, Assignment: 5 Marks)',
    },
    {
      week: 6,
      title: `Intermediate Principles & Systems Analysis in ${unitName}`,
      subs: [
        `Advanced theoretical considerations and complex scenarios`,
        `System interactions, pathway dynamics, and diagnostic interpretation`,
        `Case study examination of standard industry challenges`,
      ],
      activity: 'Case study analysis, problem-solving workshops',
      resources: 'Case study workbooks, technical charts, reference literature',
      remarks: 'Case study written submission evaluation',
    },
    {
      week: 7,
      title: `Operational Management, Protocols & Risk Mitigation`,
      subs: [
        `Risk assessment and occupational hazard management in ${unitName}`,
        `Statutory compliance, environmental regulations, and safety audits`,
        `Inter-professional communication and team management`,
      ],
      activity: 'Risk audit simulation, protocol design exercise',
      resources: 'OSHA guidelines, institutional safety manuals',
      remarks: 'Risk assessment worksheet grading',
    },
    {
      week: 8,
      title: `Continuous Assessment 2 (Official Mid-Term CAT Examination)`,
      subs: [
        `Official Mid-Term Continuous Assessment Test (CAT)`,
        `Individual logbook and practical portfolio inspection`,
      ],
      activity: 'Supervised CAT examination administration',
      resources: 'Official CAT exam booklets, attendance sheets',
      remarks: 'Official Mid-Term CAT Examination (15 Marks)',
    },
    {
      week: 9,
      title: `Specialized Applications & Advanced Techniques in ${unitName}`,
      subs: [
        `Emerging technologies and specialized methods in ${unitName}`,
        `Troubleshooting deviations, discrepancies, and anomalous findings`,
        `Evidence-based interventions and modern technical solutions`,
      ],
      activity: 'Advanced practical demonstration, technical investigation',
      resources: 'Specialized equipment, scientific journal articles',
      remarks: 'Technical problem-solving evaluation',
    },
    {
      week: 10,
      title: `Professional Standards, Quality Assurance & Documentation`,
      subs: [
        `Quality assurance (QA) and quality control (QC) frameworks`,
        `Comprehensive record management, reporting, and audit trails`,
        `Ethics, client confidentiality, and professional integrity`,
      ],
      activity: 'Audit documentation workshop, peer portfolio review',
      resources: 'QA audit checklists, official record templates',
      remarks: 'Quality audit assignment grading',
    },
    {
      week: 11,
      title: `Case Presentations & Evidence-Based Practical Demonstrations`,
      subs: [
        `Trainee group case study presentations and defenses`,
        `Critical evaluation of practical interventions in ${unitName}`,
        `Peer review and panel questions`,
      ],
      activity: 'Trainee PowerPoint / poster presentations, panel defense',
      resources: 'Projector, presentation evaluation rubrics',
      remarks: 'Trainee Presentation Assessment (10 Marks)',
    },
    {
      week: 12,
      title: `Integrated Practical Competency Evaluation & Logbook Review`,
      subs: [
        `Multi-station practical competency examination (OSPE / practical)`,
        `Synthesis of practical, clinical, or workshop skills`,
        `Final practical logbook verification and sign-off`,
      ],
      activity: 'Practical station rounds, logbook verification',
      resources: 'Practical workstations, specimen sets, evaluation scorecards',
      remarks: 'Final practical competency logbook sign-off',
    },
    {
      week: 13,
      title: `Course Synthesis, Revision & Final Examination Preparation`,
      subs: [
        `Comprehensive recap of all core syllabus competencies`,
        `Past examination question analysis and model answer review`,
        `Examination techniques, time management, and guidelines`,
      ],
      activity: 'Interactive revision seminar, model answer debrief',
      resources: 'Past examination series, comprehensive summary notes',
      remarks: 'Mock exam practice & exam readiness confirmation',
    },
    {
      week: 14,
      title: `Summative End-of-Term Examination & Assessment Evaluation`,
      subs: [
        `Supervised End-of-Term Summative Examination (70%)`,
        `Departmental grade compilation and moderation`,
        `Final markbook submission to examination board`,
      ],
      activity: 'Supervised final examination administration',
      resources: 'Official examination papers, answer scripts, mark sheets',
      remarks: 'End-of-Term Final Examination (70 Marks) — Total 100%',
    },
  ];

  return weeklyFramework.map((w) => ({
    weekNumber: w.week,
    topicTitle: `Week ${w.week}: ${w.title}`,
    subTopics: w.subs,
    learningActivities: w.activity,
    resourcesAndReferences: w.resources,
    assessmentAndRemarks: w.remarks,
  }));
}

/**
 * Finds or synthesizes a unit curriculum definition by matching code or name
 */
export function getUnitCurriculum(
  unitCode: string,
  unitName: string
): UnitCurriculumDefinition {
  const codeKey = normalizeUnitCodeKey(unitCode);

  // 1. Direct code lookup
  if (TVET_CURRICULUM_REGISTRY[codeKey]) {
    return TVET_CURRICULUM_REGISTRY[codeKey];
  }

  // 2. Name search
  for (const def of Object.values(TVET_CURRICULUM_REGISTRY)) {
    if (
      def.unitName.toLowerCase().includes(unitName.toLowerCase()) ||
      unitName.toLowerCase().includes(def.unitName.toLowerCase())
    ) {
      return {
        ...def,
        unitCode,
        unitName,
      };
    }
  }

  // 3. Fallback: Return domain-aware, structured 14-week progressive definition
  return {
    unitCode,
    unitName,
    unitDescription: `This competency-based unit equips trainees with essential theoretical principles, practical skills, and professional competencies in ${unitName} (${unitCode}). Trainees develop industry-standard skills in accordance with Imperial College occupational guidelines.`,
    overallCompetency: `Demonstrate technical proficiency in ${unitName}, executing standard workplace procedures, practical skills, and adhering to occupational safety standards.`,
    learningOutcomes: [
      `Explain the core theories, principles, and regulatory standards of ${unitName}.`,
      `Demonstrate technical proficiency in using relevant tools, diagnostic instruments, and methods for ${unitName}.`,
      `Execute practical tasks and produce compliant workplace documentation and records for ${unitName}.`,
      `Evaluate outcomes and apply quality control measures to ensure compliance in ${unitName}.`,
      'Collaborate effectively within multidisciplinary professional workplace teams.',
    ],
    weeklySchedule: generateProgressiveWeeklySchedule(unitCode, unitName),
    references: [
      'National Curriculum and Assessment Standards (CDACC/KNEC).',
      `${unitName} Course Manual & Practical Reference Handbook (College Edition).`,
      'Applicable Professional Council and Statutory Regulations.',
    ],
    instructionalEquipment: [
      'Standard College Workshop/Laboratory Equipment and Workstations.',
      'Digital Teaching Aids, Multimedia Projector, and Technical Software.',
      'Personal Protective Equipment (PPE) and Safety Manuals.',
    ],
  };
}

/**
 * Register custom seed documents dynamically or in batches
 */
export function registerUnitCurriculum(def: UnitCurriculumDefinition) {
  const codeKey = normalizeUnitCodeKey(def.unitCode);
  TVET_CURRICULUM_REGISTRY[codeKey] = def;
}

/**
 * Persists an ingested unit curriculum definition into Supabase
 */
export async function persistUnitCurriculumToDatabase(def: UnitCurriculumDefinition): Promise<void> {
  const codeKey = normalizeUnitCodeKey(def.unitCode);
  TVET_CURRICULUM_REGISTRY[codeKey] = def;

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    await admin.from('teaching_document_templates').upsert({
      id: `tpl-tvet-${codeKey}`,
      document_type: 'course_outline',
      name: def.unitCode,
      version_number: 1,
      status: 'active',
      storage_bucket: 'teaching-documents',
      storage_path: `curriculum/${codeKey}.json`,
      original_filename: JSON.stringify(def),
      notes: def.unitName,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to persist curriculum definition to DB:', err);
  }
}

/**
 * Loads a persisted unit curriculum definition from Supabase
 */
export async function loadPersistedUnitCurriculum(
  unitCode: string,
  unitName: string,
  _documentType?: 'course_outline' | 'scheme_of_work',
): Promise<UnitCurriculumDefinition> {
  const codeKey = normalizeUnitCodeKey(unitCode);

  if (TVET_CURRICULUM_REGISTRY[codeKey]) {
    return TVET_CURRICULUM_REGISTRY[codeKey];
  }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('teaching_document_templates')
      .select('original_filename')
      .eq('id', `tpl-tvet-${codeKey}`)
      .maybeSingle();

    if (row?.original_filename) {
      const parsed = JSON.parse(row.original_filename) as UnitCurriculumDefinition;
      if (parsed && parsed.unitCode) {
        TVET_CURRICULUM_REGISTRY[codeKey] = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to sync getUnitCurriculum
  }

  return getUnitCurriculum(unitCode, unitName);
}
