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
}

export interface UnitCurriculumDefinition {
  unitCode: string;
  unitName: string;
  unitDescription?: string;
  overallCompetency?: string;
  learningOutcomes?: string[];
  weeklySchedule?: SeedWeeklyTopic[];
  references?: string[];
  instructionalEquipment?: string[];
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
};

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

  // 3. Fallback: Return standard polished TVET definition based on the unit name
  return {
    unitCode,
    unitName,
    unitDescription: `This competency-based TVET unit equips trainees with essential theoretical principles, practical skills, and professional attitudes in ${unitName} (${unitCode}). Trainees develop industry competencies in accordance with national TVET occupational guidelines.`,
    overallCompetency: `Demonstrate proficiency in ${unitName}, executing standard workplace procedures, troubleshooting deviations, and adhering to occupational safety standards.`,
    learningOutcomes: [
      `Explain the core theories, principles, and regulatory standards of ${unitName}.`,
      'Demonstrate technical proficiency in using relevant tools, diagnostic instruments, and software.',
      'Execute practical tasks and produce compliant workplace documentation and records.',
      'Evaluate outcomes and apply quality control measures to ensure occupational compliance.',
      'Collaborate effectively within multidisciplinary professional workplace teams.',
    ],
    references: [
      'National TVET Curriculum and Assessment Standards (CDACC/KNEC).',
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
