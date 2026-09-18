// Authoritative TVET Curriculum Registry — Module 2
// Source: Official KNEC Diploma in Nutrition and Dietetics Curriculum Specification (Syllabus Codes 22.2.0 – 33.2.0)
// Single Source of Truth — Verbatim extraction and structured encoding from KNEC curriculum document.
// All 12 Module 2 units: isAvailable = true, full 14-week weeklySchedule populated.
import type { CanonicalCurriculumUnit } from './types';

export const MODULE_2_CURRICULUM: Record<string, CanonicalCurriculumUnit> = {
  "intro_microbiology": {
    canonicalKey: "intro_microbiology",
    syllabusCode: "22.2.0",
    unitCode: "22.2.0",
    unitName: "Introduction to Microbiology",
    moduleNumber: 2,
    nominalHours: 66,
    theoryHours: 39,
    practicalHours: 27,
    aliases: ["22.2.0", "Introduction to Microbiology", "CND 2101", "DND 2303", "CHN 2101", "DHN 2201", "DNDT 1103"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills to apply microbiology principles in food industry and nutrition practice.",
    overallCompetency: "Apply microbiology in processing foods; classify microorganisms; use, care and maintain a microscope; carry out staining procedures; prepare culture media; enumerate and cultivate microbes.",
    learningOutcomes: [
      "Explain meaning of terms and background of microbiology",
      "Classify microorganisms (bacteria, viruses, protozoa, fungi, algae)",
      "Use, care and maintain a microscope",
      "Identify prokaryotic and eukaryotic cells",
      "Sterilize basic laboratory equipment",
      "Carry out staining procedures",
      "Prepare culture media and isolate microorganisms to pure culture",
      "Enumerate microbes and explain growth curves"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "22.2.01 Introduction to Microbiology",
        subTopics: ["Meaning of terms in microbiology", "Background of microbiology", "Importance of microbiology", "Application of microbiology in food industry and nutrition"],
        hours: 5,
        specificLearningOutcomes: "Define terms; outline background; explain importance; describe applications of microbiology.",
        learningActivities: "Interactive lecture, group discussions, demonstrations, laboratory exercises.",
        resourcesAndReferences: "Live microorganism samples; fermented food samples; textbooks; diagrams; manuals.",
        assessmentAndRemarks: "Class quiz, oral questions, assignment evaluation."
      },
      {
        weekNumber: 2,
        topicTitle: "22.2.02 General Classification of Microorganisms",
        subTopics: ["Bacteria: structure, classification", "Viruses: structure and types", "Protozoa: structure and examples", "Fungi: yeasts and moulds", "Algae: classification and characteristics", "Classification of microorganisms using practical specimens"],
        hours: 5,
        specificLearningOutcomes: "Describe and classify bacteria, viruses, protozoa, fungi, and algae; distinguish morphological features.",
        learningActivities: "Lecture, group discussions, practical classification exercises.",
        resourcesAndReferences: "Diagrams of microorganism classes; textbooks; media.",
        assessmentAndRemarks: "Class quiz, oral questions, practical observation."
      },
      {
        weekNumber: 3,
        topicTitle: "22.2.03 Microscopy",
        subTopics: ["Parts of a modern light microscope", "Use, care and maintenance of microscope", "Types of microscopes: bright field, dark field, phase contrast, fluorescence, electron", "Focusing using different objectives", "Preparing smears and microscope cleaning"],
        hours: 5,
        specificLearningOutcomes: "Identify parts of a modern microscope; describe types; demonstrate use, care and maintenance; prepare smears.",
        learningActivities: "Lecture, practical microscope identification, smear preparation exercise.",
        resourcesAndReferences: "Microscopes; textbooks; diagrams; practical equipment.",
        assessmentAndRemarks: "Practical observation, oral questions, checklist."
      },
      {
        weekNumber: 4,
        topicTitle: "22.2.04 Cell Structure of Microorganisms",
        subTopics: ["Prokaryotic cells vs eukaryotic cells", "Structures of prokaryotic and eukaryotic cells", "Structures of fungi: yeast and mould", "Structures of viruses", "Drawing and labelling cross-sections of microbial cells"],
        hours: 5,
        specificLearningOutcomes: "Describe and differentiate prokaryotic and eukaryotic cells; draw and label cross-sections of microbial cells.",
        learningActivities: "Lecture, diagram drawing exercises, group discussions, practical illustration.",
        resourcesAndReferences: "Textbooks; diagrams; microscopes; practical specimens.",
        assessmentAndRemarks: "Practical drawing checklist, oral questions."
      },
      {
        weekNumber: 5,
        topicTitle: "22.2.05 Laboratory Equipment and Sterilization",
        subTopics: ["Precautions in the microbiological laboratory", "Basic apparatus: petridishes, slides, inoculation loops, pipettes, autoclave, incubators, oven, glass rods, spreaders, flasks", "Sterilization methods: dry heat, moist heat (autoclaving, tyndallisation), disinfection, irradiation", "Practical sterilization: flaming wire loop, wet heat sterilization"],
        hours: 5,
        specificLearningOutcomes: "Identify apparatus; describe sterilization methods; carry out sterilization procedures.",
        learningActivities: "Lecture, practical laboratory safety briefing, sterilization demonstrations.",
        resourcesAndReferences: "Microbiology laboratory equipment; autoclave; textbooks.",
        assessmentAndRemarks: "Practical observation checklist, oral questions."
      },
      {
        weekNumber: 6,
        topicTitle: "22.2.06 Staining Techniques",
        subTopics: ["Meaning of staining terms", "Types of dyes: positive and negative staining", "Staining techniques: Gram stain, acid-fast staining, endospore, flagella, capsule staining", "Preparation of microscopic slide smears", "Carrying out staining procedures"],
        hours: 5,
        specificLearningOutcomes: "Describe types of dyes; carry out staining techniques; prepare slide smears.",
        learningActivities: "Lecture, practical staining exercises, microscope observation.",
        resourcesAndReferences: "Staining dyes; microscopes; textbooks; practical equipment.",
        assessmentAndRemarks: "Practical checklist, oral questions."
      },
      {
        weekNumber: 7,
        topicTitle: "22.2.07 Culturing Microorganisms",
        subTopics: ["Meaning of terms: CFU, isolation, culture media", "Types of culture media: general purpose, selective, differential, enrichment", "Culturing and incubation methods: aerobic, anaerobic, microaerophilic", "Methods of isolation: streak plate, absolute dilution, pour plate", "Components of culture media: carbon, nitrogen, dyes, vitamins, agar, water", "Preparing culture media and isolating microorganisms to pure culture"],
        hours: 5,
        specificLearningOutcomes: "Describe types of culture media; explain culturing and isolation methods; prepare media and isolate microorganisms.",
        learningActivities: "Lecture, practical media preparation, isolation exercises.",
        resourcesAndReferences: "Culture media components; petridishes; autoclave; incubators; textbooks.",
        assessmentAndRemarks: "Practical observation, oral questions."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Introduction to Microbiology",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate mastery of topics covered in Weeks 1–7; identify and address conceptual gaps.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys; lecture manuals.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "22.2.08 Growth of Microorganisms",
        subTopics: ["Enumeration of microbes and control methods", "Biochemical tests", "Mechanism of microbial metabolism", "Factors affecting growth: intrinsic (pH, water activity) and extrinsic (temperature, humidity, O₂)", "Reproduction in microorganisms", "Microbial growth curves", "Cultivation methods"],
        hours: 5,
        specificLearningOutcomes: "Explain enumeration and control; describe biochemical tests and microbial growth curves; draw and interpret growth curves.",
        learningActivities: "Lecture, practical enumeration exercises, biochemical test demonstrations.",
        resourcesAndReferences: "Microbiology laboratory equipment; textbooks; diagrams.",
        assessmentAndRemarks: "Practical observation, oral questions, assignment."
      },
      {
        weekNumber: 10,
        topicTitle: "Microbial Control, Reproduction and Cultivation",
        subTopics: ["Methods of microbial control: physical and chemical", "Reproduction in bacteria: binary fission", "Reproduction in fungi: budding, sporulation", "Viral replication cycle", "Cultivation methods: pour plate, spread plate", "Enumerating microbes in practical settings"],
        hours: 5,
        specificLearningOutcomes: "Describe microbial control and reproduction; enumerate microbes using pour plate and spread plate techniques.",
        learningActivities: "Practical cultivation and enumeration exercises, lecture discussions.",
        resourcesAndReferences: "Culture media; colony counters; textbooks.",
        assessmentAndRemarks: "Practical checklist, oral questions."
      },
      {
        weekNumber: 11,
        topicTitle: "Applied Microbiology in Food Safety and Fermentation",
        subTopics: ["Microorganisms in food fermentation: lactic acid bacteria, yeasts", "Fermented food products: yoghurt, cheese, fermented cereals, beverages", "Beneficial vs. harmful microorganisms in food", "Probiotics and their role in gut health and nutrition"],
        hours: 5,
        specificLearningOutcomes: "Explain role of microorganisms in fermentation; identify fermented foods; describe probiotics and nutritional significance.",
        learningActivities: "Practical fermentation demonstration, group discussion, case studies.",
        resourcesAndReferences: "Fermented food samples; textbooks; internet resources.",
        assessmentAndRemarks: "Practical observation, assignment."
      },
      {
        weekNumber: 12,
        topicTitle: "Microbiological Quality Assurance in Food and Nutrition Practice",
        subTopics: ["Food contamination sources and routes", "Microbial food safety standards and critical limits", "Hazard Analysis and Critical Control Points (HACCP) overview", "Personal hygiene and sanitation protocols for food handlers"],
        hours: 5,
        specificLearningOutcomes: "Identify food contamination sources; describe HACCP; apply personal hygiene protocols.",
        learningActivities: "Lecture, case studies on food safety incidents, practical hygiene audits.",
        resourcesAndReferences: "KEBS food safety standards; WHO food safety resources; textbooks.",
        assessmentAndRemarks: "Case study analysis, oral questions."
      },
      {
        weekNumber: 13,
        topicTitle: "22.2.09 Emerging Issues and Trends in Microbiology",
        subTopics: ["Emerging issues and trends in food microbiology", "Challenges posed by emerging trends", "Antibiotic resistance and implications for food safety", "Ways of coping: biotechnology applications, biocontrol", "Strategies addressing emerging issues and trends"],
        hours: 5,
        specificLearningOutcomes: "Discuss emerging issues; describe antibiotic resistance; explain coping strategies and biotechnology applications.",
        learningActivities: "Discussions, presentations, research on emerging issues.",
        resourcesAndReferences: "Journal articles; WHO Antimicrobial Resistance reports; textbooks.",
        assessmentAndRemarks: "Oral presentation, assignment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Introduction to Microbiology",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical examination: staining, microscope use, or culture media preparation"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of microbiology principles and skills.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Tortora, G. J., Funke, B. R., & Case, C. L. (2019). Microbiology: An Introduction (13th ed.). Pearson.",
      "Prescott, L. M. (2017). Microbiology (10th ed.). McGraw-Hill."
    ],
    instructionalEquipment: ["Microscopes", "Autoclave", "Incubators", "Petridishes and slides", "Staining dyes", "Whiteboard and LCD projector"]
  },

  "diet_therapy_ii": {
    canonicalKey: "diet_therapy_ii",
    syllabusCode: "23.2.0",
    unitCode: "23.2.0",
    unitName: "Diet Therapy II",
    moduleNumber: 2,
    nominalHours: 66,
    theoryHours: 39,
    practicalHours: 27,
    aliases: ["23.2.0", "Diet Therapy II", "CND 2201", "DND 2105", "DHN 2205", "DNDT 1104"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills to apply dietary therapy principles in the management of diseases.",
    overallCompetency: "Apply the knowledge of diet therapy; manage diseases through appropriate dietary modification; plan therapeutic diets for liver, gallbladder, pancreatic, cardiovascular, lung, and renal diseases.",
    learningOutcomes: [
      "Explain meaning of terms, importance, and scope of diet therapy",
      "Plan therapeutic diets for liver and gallbladder diseases",
      "Plan therapeutic diets for pancreatic disorders",
      "Manage cardiovascular and lung diseases through diet",
      "Plan diets for patients with renal diseases",
      "Discuss emerging issues and trends in diet therapy"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "23.2.01 Introduction to Diet Therapy",
        subTopics: ["Meaning of terms in diet therapy", "Importance of diet therapy in clinical practice", "Scope of diet therapy: preventive, curative, and palliative roles", "Overview of therapeutic diets and their indications"],
        hours: 5,
        specificLearningOutcomes: "Define terms; explain importance; discuss scope of diet therapy.",
        learningActivities: "Interactive lecture, group discussions, case-based presentations.",
        resourcesAndReferences: "Resource persons; manuals; food samples; textbooks; internet; charts.",
        assessmentAndRemarks: "Class quiz, oral questions, assignment."
      },
      {
        weekNumber: 2,
        topicTitle: "23.2.02 Diseases of the Liver and Gallbladder — Part I",
        subTopics: ["Types of liver and gallbladder diseases: hepatitis, cirrhosis, fatty liver, cholecystitis, cholelithiasis", "Etiology of liver and gallbladder diseases", "Causes of liver and gallbladder diseases"],
        hours: 5,
        specificLearningOutcomes: "Identify types; describe etiology and causes of liver and gallbladder diseases.",
        learningActivities: "Lecture, case discussions, clinical scenario analysis.",
        resourcesAndReferences: "Medical nutrition textbooks; clinical case studies; internet.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 3,
        topicTitle: "23.2.02 Diseases of the Liver and Gallbladder — Part II",
        subTopics: ["Signs and symptoms of liver and gallbladder diseases", "Management through dietary modification and nutritional support", "Gallbladder disease: dietary fat modification", "Planning diets for liver and gallbladder patients"],
        hours: 5,
        specificLearningOutcomes: "Describe signs and symptoms; discuss management; plan therapeutic diets for liver and gallbladder conditions.",
        learningActivities: "Lecture, practical diet planning exercises, clinical discussions.",
        resourcesAndReferences: "Food samples; textbooks; diet planning resources.",
        assessmentAndRemarks: "Diet plan submission, case study analysis."
      },
      {
        weekNumber: 4,
        topicTitle: "23.2.03 Pancreatic Disorders",
        subTopics: ["Meaning of terms", "Types of pancreatic disorders: pancreatitis, pancreatic cancer, diabetes mellitus", "Etiology and causes of pancreatic disorders", "Signs and symptoms", "Management through dietary modification", "Planning diets for pancreatic conditions"],
        hours: 5,
        specificLearningOutcomes: "Define terms; identify types; describe management; plan diets for pancreatic conditions.",
        learningActivities: "Lecture, practical diet planning, case scenario analysis.",
        resourcesAndReferences: "Medical nutrition therapy textbooks; food composition tables.",
        assessmentAndRemarks: "Diet plan, case study discussion."
      },
      {
        weekNumber: 5,
        topicTitle: "23.2.04 Cardiovascular and Lung Diseases — Part I",
        subTopics: ["Meaning of terms", "Types of cardiovascular diseases: hypertension, coronary artery disease, heart failure, atherosclerosis, dyslipidaemia", "Types of lung diseases: COPD, asthma, tuberculosis", "Etiology and causes of cardiovascular and lung diseases"],
        hours: 5,
        specificLearningOutcomes: "Define terms; describe types; explain etiology and causes of cardiovascular and lung diseases.",
        learningActivities: "Lecture, group discussions, clinical case presentations.",
        resourcesAndReferences: "Medical nutrition textbooks; WHO cardiovascular guidelines; internet.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 6,
        topicTitle: "23.2.04 Cardiovascular and Lung Diseases — Part II",
        subTopics: ["Signs and symptoms of cardiovascular and lung diseases", "Medical nutrition therapy: DASH diet, fat restriction, sodium restriction", "Dietary modifications for lung disease patients", "Planning diets for cardiovascular and lung disease patients"],
        hours: 5,
        specificLearningOutcomes: "Describe signs and symptoms; plan therapeutic diets for cardiovascular and lung conditions.",
        learningActivities: "Lecture, practical diet planning, group case discussions.",
        resourcesAndReferences: "DASH diet resources; food composition tables; clinical guidelines.",
        assessmentAndRemarks: "Diet plan submission."
      },
      {
        weekNumber: 7,
        topicTitle: "23.2.05 Renal Diseases — Part I",
        subTopics: ["Meaning of terms", "Types of renal diseases: acute kidney injury, chronic kidney disease, nephrotic syndrome, nephrolithiasis", "Etiology of renal diseases", "Causes and risk factors for renal diseases"],
        hours: 5,
        specificLearningOutcomes: "Define terms; identify types; describe etiology and causes of renal diseases.",
        learningActivities: "Lecture, clinical case discussions, group analysis.",
        resourcesAndReferences: "Medical nutrition textbooks; renal dietetics resources.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Diet Therapy II",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate mastery of topics covered in Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys; lecture manuals.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "23.2.05 Renal Diseases — Part II",
        subTopics: ["Signs and symptoms of renal diseases", "Management: protein restriction, potassium, phosphorus, and fluid management", "Haemodialysis and peritoneal dialysis nutritional considerations", "Planning diets for renal disease patients"],
        hours: 5,
        specificLearningOutcomes: "Describe signs and symptoms; plan therapeutic diets for renal conditions.",
        learningActivities: "Lecture, practical diet planning exercises, case discussions.",
        resourcesAndReferences: "Renal diet planning resources; food composition tables.",
        assessmentAndRemarks: "Diet plan submission."
      },
      {
        weekNumber: 10,
        topicTitle: "Cancer and HIV/AIDS: Nutritional Management",
        subTopics: ["Nutritional consequences of cancer and cancer treatment", "Medical nutrition therapy for cancer patients", "Nutritional management of HIV and AIDS: nutrient-drug interactions, supplementation", "Wasting syndrome management in HIV"],
        hours: 5,
        specificLearningOutcomes: "Plan diets for cancer patients; discuss nutritional management of HIV and AIDS.",
        learningActivities: "Lecture, case studies, group discussions.",
        resourcesAndReferences: "WHO HIV Nutrition Guidelines; cancer nutrition resources; textbooks.",
        assessmentAndRemarks: "Case study analysis, oral questions."
      },
      {
        weekNumber: 11,
        topicTitle: "Metabolic Disorders: Diabetes and Obesity Nutritional Management",
        subTopics: ["Medical nutrition therapy for type 1 and type 2 diabetes: carbohydrate counting, glycaemic index", "Nutritional management of obesity: energy deficit, macronutrient distribution", "Metabolic syndrome: definition, risk factors, and dietary interventions", "Practical diet planning for diabetes and obesity"],
        hours: 5,
        specificLearningOutcomes: "Plan therapeutic diets for diabetes mellitus and obesity; describe dietary approaches to metabolic syndrome.",
        learningActivities: "Practical diet calculation exercises, case presentations, lecture.",
        resourcesAndReferences: "Diabetes diet planning resources; food composition tables; clinical guidelines.",
        assessmentAndRemarks: "Diet plan submission, case analysis."
      },
      {
        weekNumber: 12,
        topicTitle: "Surgical Nutrition and Nutritional Support",
        subTopics: ["Metabolic response to surgery and trauma", "Pre-operative and post-operative nutritional care", "Enteral nutrition: indications, types, feeding routes", "Parenteral nutrition: indications, composition, administration principles"],
        hours: 5,
        specificLearningOutcomes: "Describe metabolic response to surgery; plan pre/post-operative nutritional care; describe enteral and parenteral nutrition.",
        learningActivities: "Lecture, clinical case study discussions, demonstration.",
        resourcesAndReferences: "Clinical nutrition textbooks; ASPEN and ESPEN guidelines.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 13,
        topicTitle: "23.2.06 Emerging Issues and Trends in Diet Therapy",
        subTopics: ["Emerging issues and trends in clinical nutrition", "Challenges posed by emerging issues: NCD burden, food insecurity", "Coping strategies: community-based nutrition programmes, technology in dietetics", "Pharmaconutrition and functional foods in therapeutic settings"],
        hours: 5,
        specificLearningOutcomes: "Discuss emerging issues; identify challenges and coping strategies; describe functional foods in therapy.",
        learningActivities: "Discussions, presentations, case studies.",
        resourcesAndReferences: "Current journal articles; WHO nutrition reports; internet.",
        assessmentAndRemarks: "Oral presentation, assignment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Diet Therapy II",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical diet planning case examination"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of clinical nutrition and therapeutic diet planning.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Mahan, L. K., & Raymond, J. L. (2017). Krause's Food and the Nutrition Care Process (14th ed.). Elsevier.",
      "Escott-Stump, S. (2015). Nutrition and Diagnosis-Related Care (8th ed.). Lippincott Williams & Wilkins."
    ],
    instructionalEquipment: ["Whiteboard and LCD projector", "Food composition tables", "Diet planning worksheets", "Clinical case study portfolios"]
  },

  "food_processing_preservation": {
    canonicalKey: "food_processing_preservation",
    syllabusCode: "24.2.0",
    unitCode: "24.2.0",
    unitName: "Principles of Food Processing and Preservation",
    moduleNumber: 2,
    nominalHours: 66,
    theoryHours: 39,
    practicalHours: 27,
    aliases: ["24.2.0", "Principles of Food Processing and Preservation", "CND 2106", "CND 2202", "DND 2106", "DHN 2204", "DNDT 1106"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills of food processing and preservation.",
    overallCompetency: "Identify types of food spoilage; determine causes of food spoilage; identify appropriate preservation methods; perform particular processing and preservation operations.",
    learningOutcomes: [
      "Explain meaning of terms and aims of food processing and preservation",
      "Identify causes of food deterioration",
      "Describe chemical changes in food components during storage and processing",
      "Explain principles and methods of food preservation",
      "Apply thermal processing techniques",
      "Apply low temperature preservation methods",
      "Carry out fermentation, pickling, salting, smoking",
      "Describe food additives and irradiation",
      "Describe packaging methods"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "24.2.01 Introduction to Food Processing and Preservation",
        subTopics: ["Meaning of terms: food processing, food preservation, food deterioration", "Aims of food processing and preservation", "Overview of food processing and preservation methods", "Importance of food processing in nutritional security"],
        hours: 5,
        specificLearningOutcomes: "Define terms; explain aims of food processing and preservation; identify importance.",
        learningActivities: "Lecture, group discussions, practical introduction to food samples.",
        resourcesAndReferences: "Food samples; textbooks; diagrams; internet.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "24.2.02 Factors Causing Food Deterioration",
        subTopics: ["Microbial spoilage: bacteria, yeasts, moulds", "Food enzymes: enzymatic browning, ripening", "Insects, parasites, and rodents", "Environmental factors: temperature, moisture, oxygen, light, duration", "Identification of signs of food deterioration"],
        hours: 5,
        specificLearningOutcomes: "Explain causes of food deterioration; identify signs of food deterioration.",
        learningActivities: "Lecture, practical inspection of deteriorated food samples, group discussions.",
        resourcesAndReferences: "Food samples in different states; textbooks.",
        assessmentAndRemarks: "Practical observation checklist, oral questions."
      },
      {
        weekNumber: 3,
        topicTitle: "24.2.03 Chemical Changes in Food During Storage and Processing",
        subTopics: ["Browning: enzymatic vs. non-enzymatic (Maillard reaction)", "Ripening: changes in pigments, sugars, organic acids", "Sprouting and effects on nutritional quality", "Hydrolysis: fats, proteins, carbohydrates", "Oxidation: lipid peroxidation and rancidity", "Thermal degradation: effects on vitamins and proteins"],
        hours: 5,
        specificLearningOutcomes: "Explain chemical changes in food; describe browning, ripening, sprouting, hydrolysis, oxidation, thermal degradation.",
        learningActivities: "Lecture, practical demonstration of browning reactions.",
        resourcesAndReferences: "Food samples; textbooks; charts.",
        assessmentAndRemarks: "Practical observation, oral questions."
      },
      {
        weekNumber: 4,
        topicTitle: "24.2.04 Principles and Methods of Food Preservation",
        subTopics: ["Preservation principles: destroying microorganisms, inhibiting growth, preventing contamination", "Classification: thermal processing, low temperature, dehydration, chemical, biological", "Selection criteria for appropriate preservation method", "Demonstration of preservation method principles"],
        hours: 5,
        specificLearningOutcomes: "Describe principles of food preservation methods; classify methods; demonstrate principles.",
        learningActivities: "Lecture, practical demonstration of preservation principles.",
        resourcesAndReferences: "Preservation equipment; food samples; textbooks.",
        assessmentAndRemarks: "Practical demonstration checklist."
      },
      {
        weekNumber: 5,
        topicTitle: "24.2.05 Thermal Processing",
        subTopics: ["Blanching: objectives, methods (water/steam), effects on food quality", "Pasteurization: objectives, methods (HTST, LTLT), effects on food", "Sterilization: commercial sterilization, stages in canning, spoilage of canned products", "Practical: blanching and pasteurization of food materials"],
        hours: 5,
        specificLearningOutcomes: "Describe blanching, pasteurization, sterilization; carry out blanching and pasteurization; achieve commercial sterilization.",
        learningActivities: "Lecture, practical blanching and pasteurization exercises.",
        resourcesAndReferences: "Blanching equipment; pasteurizer; textbooks.",
        assessmentAndRemarks: "Practical observation checklist."
      },
      {
        weekNumber: 6,
        topicTitle: "24.2.06 Low Temperature Preservation",
        subTopics: ["Terminologies: refrigeration, cold storage, chilling, freezing, thawing", "Methods and applications of low temperature preservation", "Effects of low temperatures on food quality", "Thawing process and effects on food safety", "Practical: operation of refrigeration and freezing equipment"],
        hours: 5,
        specificLearningOutcomes: "Define terminologies; describe methods and effects of low temperature preservation; apply thawing methods.",
        learningActivities: "Lecture, practical demonstration of low temperature preservation.",
        resourcesAndReferences: "Refrigerator; freezer; food samples; textbooks.",
        assessmentAndRemarks: "Practical observation."
      },
      {
        weekNumber: 7,
        topicTitle: "Evaporation, Dehydration, and Reconstitution",
        subTopics: ["Methods: sun drying, oven drying, spray drying, freeze drying", "Terminologies and definitions", "Reconstitution of dried foods", "Effects of dehydration on food quality and nutritional value", "Practical: sun drying and oven drying of food products"],
        hours: 5,
        specificLearningOutcomes: "Describe evaporation and dehydration methods; carry out drying of food products; reconstitute dried foods.",
        learningActivities: "Lecture, practical drying exercises.",
        resourcesAndReferences: "Drying equipment; food samples; textbooks.",
        assessmentAndRemarks: "Practical observation, report."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Food Processing and Preservation",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate mastery of topics from Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys; lecture manuals.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "24.2.08 Fermentation and Pickling",
        subTopics: ["Fermentation process: lactic acid and alcoholic fermentation", "Production of pickles: vegetables, fruits", "Preparation of pickles for use", "Traditional fermented foods in Kenya: uji, muratina, mursik", "Practical: fermentation and pickling of food products"],
        hours: 5,
        specificLearningOutcomes: "Describe fermentation process and types; produce pickles and fermented food products.",
        learningActivities: "Lecture, practical fermentation and pickling exercises.",
        resourcesAndReferences: "Fermentation jars; vegetables; salt; starter cultures.",
        assessmentAndRemarks: "Practical observation, product assessment."
      },
      {
        weekNumber: 10,
        topicTitle: "24.2.09 Salting and Smoking",
        subTopics: ["Effects of salt: osmosis, water activity reduction, microbial inhibition", "Methods of salting: dry salting, wet salting, brine curing", "Effects of smoke on foods: phenols, formaldehyde, bactericidal effects", "Methods of smoking: hot smoking, cold smoking", "Practical: salting and smoking of fish and meat products"],
        hours: 5,
        specificLearningOutcomes: "Explain effects of salt and smoke; describe salting and smoking methods; carry out salting and smoking.",
        learningActivities: "Lecture, practical salting and smoking exercise.",
        resourcesAndReferences: "Salt; smoking equipment; fish/meat samples; textbooks.",
        assessmentAndRemarks: "Practical observation, product report."
      },
      {
        weekNumber: 11,
        topicTitle: "24.2.10 Controlled Atmosphere Storage and Food Additives",
        subTopics: ["Controlled atmosphere (CA) storage: principles and applications", "Modified atmosphere packaging (MAP) for fresh produce", "Food additives: aims, terminologies, classes (preservatives, antioxidants, emulsifiers, colouring)", "Safe use of additives: ADI, regulatory standards", "Irradiation: safety and applications"],
        hours: 5,
        specificLearningOutcomes: "Describe CA and MAP storage; explain food additives classes and safe use; describe irradiation.",
        learningActivities: "Lecture, case studies on food labelling and additive regulations.",
        resourcesAndReferences: "KEBS standards; food packages; textbooks.",
        assessmentAndRemarks: "Assignment, oral questions."
      },
      {
        weekNumber: 12,
        topicTitle: "Food Packaging and Quality Control",
        subTopics: ["Aims of packaging: protection, convenience, marketing", "Properties required of packaging materials: permeability, mechanical strength, inertness", "Packaging materials for specific foods: glass, tin, plastic, paper, laminates", "Food quality control and evaluation in processing"],
        hours: 5,
        specificLearningOutcomes: "Describe aims of packaging; identify appropriate packaging materials; explain food quality control.",
        learningActivities: "Lecture, practical packaging material analysis.",
        resourcesAndReferences: "Packaging samples; textbooks; KEBS packaging standards.",
        assessmentAndRemarks: "Practical exercise, assignment."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in Food Processing and Preservation",
        subTopics: ["Emerging issues: nanotechnology, functional food processing, clean-label movement", "Challenges: food waste, environmental impact of processing", "Coping strategies: minimal processing, sustainable packaging", "Ways of managing challenges posed by emerging issues and trends"],
        hours: 5,
        specificLearningOutcomes: "Discuss emerging issues; identify challenges and coping strategies; describe minimal and sustainable processing.",
        learningActivities: "Presentations, discussions, journal article reviews.",
        resourcesAndReferences: "Journal articles; industry reports; internet.",
        assessmentAndRemarks: "Oral presentation, assignment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Food Processing and Preservation",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical examination: food preservation technique demonstration"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of food processing and preservation principles.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Fellows, P. J. (2017). Food Processing Technology: Principles and Practice (4th ed.). Woodhead Publishing.",
      "FAO/WHO. (2016). General Principles of Food Hygiene. Codex Alimentarius."
    ],
    instructionalEquipment: ["Blanching and pasteurization equipment", "Refrigerator and freezer", "Drying oven/sun drying trays", "Fermentation jars", "Smoking equipment", "Food samples", "Whiteboard and LCD projector"]
  },

  "intro_biostatistics": {
    canonicalKey: "intro_biostatistics",
    syllabusCode: "25.2.0",
    unitCode: "25.2.0",
    unitName: "Introduction to Biostatistics",
    moduleNumber: 2,
    nominalHours: 66,
    theoryHours: 39,
    practicalHours: 27,
    aliases: ["25.2.0", "Introduction to Biostatistics", "CND 2104", "DND 2304", "DHN 2202", "DNDT 1102"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills to apply statistical methods in nutrition and health research.",
    overallCompetency: "Define biostatistical terms; collect, organize, and present data; compute measures of central tendency, dispersion, and correlation; calculate rates, ratios, and proportions; test statistical hypotheses.",
    learningOutcomes: [
      "Explain meaning of terms and concepts in biostatistics",
      "Describe types of data and data collection methods",
      "Present data using tables, graphs, and charts",
      "Compute measures of central tendency and dispersion",
      "Calculate rates, ratios, and proportions used in nutrition and health",
      "Compute measures of association and correlation",
      "Apply tests of statistical significance"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "25.2.01 Introduction to Biostatistics",
        subTopics: ["Definition of biostatistics and related terms", "Importance and application of biostatistics in nutrition and health", "Types of data: quantitative (discrete, continuous) and qualitative (nominal, ordinal)", "Levels of measurement: nominal, ordinal, interval, ratio"],
        hours: 5,
        specificLearningOutcomes: "Define biostatistics; explain importance; differentiate types and levels of data.",
        learningActivities: "Lecture, group discussions, practical data identification exercises.",
        resourcesAndReferences: "Biostatistics textbooks; charts; internet.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "25.2.02 Data Collection Methods",
        subTopics: ["Types of data collection methods: interviews, questionnaires, observation, records review", "Designing data collection instruments", "Sampling methods: random, systematic, stratified, cluster, purposive", "Sample size determination principles"],
        hours: 5,
        specificLearningOutcomes: "Describe data collection methods; design simple instruments; differentiate sampling methods.",
        learningActivities: "Lecture, practical questionnaire design exercise.",
        resourcesAndReferences: "Sample questionnaires; textbooks.",
        assessmentAndRemarks: "Practical exercise, oral questions."
      },
      {
        weekNumber: 3,
        topicTitle: "25.2.03 Data Presentation",
        subTopics: ["Tabulation of data: frequency distribution tables", "Grouped frequency distributions", "Bar charts, histograms, pie charts", "Line graphs and scatter plots", "Interpretation of graphical data presentations"],
        hours: 5,
        specificLearningOutcomes: "Construct frequency tables; present data using charts and graphs; interpret data presentations.",
        learningActivities: "Lecture, practical graph and chart construction exercises.",
        resourcesAndReferences: "Graph paper; calculators; Excel; textbooks.",
        assessmentAndRemarks: "Practical exercise, checklist."
      },
      {
        weekNumber: 4,
        topicTitle: "25.2.04 Measures of Central Tendency",
        subTopics: ["Mean: arithmetic, weighted", "Median: computation from raw data and frequency tables", "Mode: unimodal, bimodal, multimodal", "Properties and appropriate use of each measure", "Practical calculations and interpretation"],
        hours: 5,
        specificLearningOutcomes: "Define measures of central tendency; compute mean, median, mode from raw and grouped data; interpret.",
        learningActivities: "Lecture, practical calculation exercises, group work.",
        resourcesAndReferences: "Calculators; computation worksheets; textbooks.",
        assessmentAndRemarks: "Practical exercises, assignment."
      },
      {
        weekNumber: 5,
        topicTitle: "25.2.04 Measures of Dispersion",
        subTopics: ["Range: simple and interquartile", "Variance and standard deviation", "Coefficient of variation", "Normal distribution curve and its properties", "Percentiles and z-scores"],
        hours: 5,
        specificLearningOutcomes: "Define measures of dispersion; compute range, variance, standard deviation; describe normal distribution and interpret z-scores.",
        learningActivities: "Lecture, practical calculation exercises.",
        resourcesAndReferences: "Calculators; computation worksheets; textbooks.",
        assessmentAndRemarks: "Practical exercises, assignment."
      },
      {
        weekNumber: 6,
        topicTitle: "Nutritional Anthropometry Statistics: Z-scores and WHO Reference Standards",
        subTopics: ["Anthropometric indices: weight-for-age, height-for-age, weight-for-height, BMI-for-age", "WHO growth standards: z-score classification (severe, moderate, mild malnutrition)", "Malnutrition classification using MUAC cut-offs", "Computing nutritional z-scores using WHO Anthro software"],
        hours: 5,
        specificLearningOutcomes: "Compute nutritional z-scores; classify malnutrition; interpret anthropometric indices at population level.",
        learningActivities: "Practical WHO Anthro software exercise, group data interpretation.",
        resourcesAndReferences: "WHO Anthro software; WHO growth charts; computers.",
        assessmentAndRemarks: "Practical exercise, report."
      },
      {
        weekNumber: 7,
        topicTitle: "25.2.07 Rates, Ratios, Proportions and Nutritional Indices",
        subTopics: ["Definitions: rate, ratio, proportion", "Rates in public health: incidence rate, prevalence rate, crude rate, specific rate", "Nutritional indicators: stunting, wasting, GAM prevalence", "Disability-adjusted life years (DALYs) and nutritional significance"],
        hours: 5,
        specificLearningOutcomes: "Define rate, ratio, proportion; calculate incidence and prevalence rates; compute and interpret nutritional indicators.",
        learningActivities: "Lecture, practical calculation exercises.",
        resourcesAndReferences: "Calculators; epidemiological data sets; textbooks.",
        assessmentAndRemarks: "Practical exercises, assignment."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Introduction to Biostatistics",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate mastery of topics covered in Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys; lecture manuals.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "Correlation and Regression Analysis",
        subTopics: ["Types of correlation: positive, negative, zero", "Pearson and Spearman correlation coefficients", "Scatter diagrams: construction and interpretation", "Simple linear regression: regression equation, slope and intercept", "Coefficient of determination (R²)"],
        hours: 5,
        specificLearningOutcomes: "Explain types of correlation; compute Pearson coefficient; construct scatter diagrams; derive linear regression equations.",
        learningActivities: "Lecture, practical correlation and regression exercises.",
        resourcesAndReferences: "Calculators; Excel; statistical worksheets; textbooks.",
        assessmentAndRemarks: "Practical exercises, assignment."
      },
      {
        weekNumber: 10,
        topicTitle: "Probability and Probability Distributions",
        subTopics: ["Concept and rules of probability: addition, multiplication, complementary", "Binomial distribution: characteristics and applications", "Normal distribution: standard normal table, area under the curve", "Application of probability in nutrition risk assessment"],
        hours: 5,
        specificLearningOutcomes: "Explain rules of probability; describe binomial and normal distributions; apply probability in nutrition.",
        learningActivities: "Lecture, probability calculation exercises.",
        resourcesAndReferences: "Statistical tables; textbooks; calculators.",
        assessmentAndRemarks: "Practical exercises, assignment."
      },
      {
        weekNumber: 11,
        topicTitle: "25.2.10 Tests of Statistical Significance — Part I",
        subTopics: ["Concept of hypothesis testing: null and alternative hypothesis", "Type I and Type II errors", "Level of significance (p-value), confidence intervals", "z-test for large samples", "t-test: one-sample, independent samples, paired samples"],
        hours: 5,
        specificLearningOutcomes: "Explain hypothesis testing; define Type I and II errors; apply z-test and t-tests.",
        learningActivities: "Lecture, hypothesis testing exercises.",
        resourcesAndReferences: "Statistical tables; calculators; textbooks.",
        assessmentAndRemarks: "Practical exercises."
      },
      {
        weekNumber: 12,
        topicTitle: "25.2.10 Tests of Statistical Significance — Part II",
        subTopics: ["Chi-square (χ²) test: goodness of fit and test of independence", "Analysis of variance (ANOVA): one-way and two-way", "Non-parametric tests: Mann-Whitney U, Wilcoxon signed-rank, Kruskal-Wallis", "Selecting appropriate statistical tests"],
        hours: 5,
        specificLearningOutcomes: "Apply chi-square test; apply one-way ANOVA; select appropriate tests for different data types.",
        learningActivities: "Lecture, statistical test exercises, computer practical.",
        resourcesAndReferences: "Statistical tables; calculators; SPSS; textbooks.",
        assessmentAndRemarks: "Practical exercises, assignment."
      },
      {
        weekNumber: 13,
        topicTitle: "Data Analysis and Reporting in Nutritional Research",
        subTopics: ["Steps in data analysis: editing, coding, entry, cleaning, analysis", "Using SPSS/Excel for nutritional research data analysis", "Interpreting and reporting statistical results", "Research ethics in data handling"],
        hours: 5,
        specificLearningOutcomes: "Apply SPSS/Excel to analyse nutritional data; interpret and report statistical results accurately.",
        learningActivities: "Computer laboratory practical, data analysis exercise.",
        resourcesAndReferences: "SPSS/Excel; sample data sets; computers.",
        assessmentAndRemarks: "Analysis report, oral questions."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Introduction to Biostatistics",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical statistical computation examination"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of biostatistics principles and applications.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; statistical tables; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Kirkwood, B. R., & Sterne, J. A. C. (2003). Essential Medical Statistics (2nd ed.). Blackwell Science.",
      "WHO. (2006). WHO Child Growth Standards. World Health Organization."
    ],
    instructionalEquipment: ["Calculators", "Computers with SPSS and Excel", "WHO Anthro software", "Graph paper", "Statistical tables", "Whiteboard and LCD projector"]
  },

  "basic_biochemistry": {
    canonicalKey: "basic_biochemistry",
    syllabusCode: "26.2.0",
    unitCode: "26.2.0",
    unitName: "Basic Biochemistry",
    moduleNumber: 2,
    nominalHours: 66,
    theoryHours: 39,
    practicalHours: 27,
    aliases: ["26.2.0", "Basic Biochemistry", "CND 2105", "DND 2305", "DND 3106", "DHN 2203", "DHN 2304", "DNDT 1105", "DNDT 1207", "Biochemistry I", "Biochemistry II"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills to understand the chemical composition, structure, and metabolic functions of biological molecules relevant to human nutrition.",
    overallCompetency: "Describe structure and function of carbohydrates, lipids, proteins, vitamins, minerals, and enzymes; explain digestion, absorption, and metabolism; carry out basic biochemistry laboratory analyses.",
    learningOutcomes: [
      "Explain the chemical basis of nutrition and biochemistry",
      "Describe structure and functions of carbohydrates and their metabolism",
      "Describe structure and functions of lipids and their metabolism",
      "Describe structure and functions of proteins and amino acids",
      "Explain enzyme structure, function, and regulation",
      "Describe the role of vitamins and minerals in metabolism",
      "Carry out qualitative biochemical analysis tests"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Introduction to Biochemistry and Water",
        subTopics: ["Meaning of terms in biochemistry", "Importance of biochemistry to nutrition and health sciences", "Chemical bonds: ionic, covalent, hydrogen, van der Waals", "Acids, bases, and pH: buffers in biological systems", "Structure and properties of water: hydrogen bonding, polarity, role in biological reactions"],
        hours: 5,
        specificLearningOutcomes: "Define terms; explain importance; describe chemical bonds; explain water properties and acid-base balance.",
        learningActivities: "Lecture, laboratory introduction, group discussions.",
        resourcesAndReferences: "Biochemistry textbooks; laboratory equipment; diagrams.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "Carbohydrates — Structure and Classification",
        subTopics: ["Classification: monosaccharides (glucose, fructose, galactose), disaccharides (sucrose, lactose, maltose), polysaccharides (starch, glycogen, cellulose, fibre)", "Structure and functions of carbohydrates in the body", "Glycosidic bonds and ring structures"],
        hours: 5,
        specificLearningOutcomes: "Define and classify carbohydrates; describe structure and functions of mono, di, and polysaccharides.",
        learningActivities: "Lecture, diagram drawing exercises, group discussions.",
        resourcesAndReferences: "Molecular models; textbooks; diagrams.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 3,
        topicTitle: "Carbohydrate Digestion, Absorption, and Metabolism",
        subTopics: ["Digestion: salivary amylase, pancreatic amylase, brush border enzymes", "Absorption: SGLT1, GLUT transporters", "Glycolysis: steps and energy yield", "Krebs (TCA) cycle: overview and significance", "Gluconeogenesis and glycogenolysis", "Blood glucose regulation: insulin, glucagon"],
        hours: 5,
        specificLearningOutcomes: "Describe carbohydrate digestion and absorption; outline glycolysis and TCA cycle; explain blood glucose regulation.",
        learningActivities: "Lecture, metabolic pathway diagram exercises.",
        resourcesAndReferences: "Metabolic pathway charts; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 4,
        topicTitle: "Lipids — Structure and Classification",
        subTopics: ["Classification: simple lipids (triglycerides, waxes), compound lipids (phospholipids, glycolipids), derived lipids (sterols)", "Fatty acid structure: saturated, monounsaturated, polyunsaturated, trans fats, omega-3 and omega-6", "Phospholipid structure and membrane function", "Cholesterol: structure, types (LDL, HDL, VLDL)"],
        hours: 5,
        specificLearningOutcomes: "Define and classify lipids; describe structure of triglycerides, phospholipids, sterols; distinguish fatty acid types.",
        learningActivities: "Lecture, molecular model exercises, group discussions.",
        resourcesAndReferences: "Molecular models; textbooks; diagrams.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 5,
        topicTitle: "Lipid Digestion, Absorption, and Metabolism",
        subTopics: ["Digestion: lingual lipase, pancreatic lipase, bile salts", "Absorption: micelle formation, chylomicron formation, lymphatic transport", "Beta-oxidation of fatty acids: steps and energy yield", "Ketogenesis: ketone bodies and role in starvation", "Lipogenesis and lipoprotein metabolism"],
        hours: 5,
        specificLearningOutcomes: "Describe lipid digestion and absorption; outline beta-oxidation and ketogenesis; explain lipoprotein metabolism.",
        learningActivities: "Lecture, metabolic pathway exercises.",
        resourcesAndReferences: "Metabolic pathway charts; textbooks.",
        assessmentAndRemarks: "Assignment, oral questions."
      },
      {
        weekNumber: 6,
        topicTitle: "Proteins and Amino Acids — Structure and Classification",
        subTopics: ["Classification of amino acids: essential, non-essential, conditionally essential", "Amino acid structure: amino group, carboxyl group, R group", "Peptide bond formation", "Protein structure: primary, secondary, tertiary, quaternary", "Protein denaturation and nutritional implications"],
        hours: 5,
        specificLearningOutcomes: "Define proteins and classify amino acids; describe protein structure at four levels; explain denaturation.",
        learningActivities: "Lecture, diagram exercises, group discussions.",
        resourcesAndReferences: "Molecular models; textbooks.",
        assessmentAndRemarks: "Assignment, oral questions."
      },
      {
        weekNumber: 7,
        topicTitle: "Protein Digestion, Absorption, and Metabolism",
        subTopics: ["Protein digestion: pepsin, trypsin, chymotrypsin, peptidases", "Absorption of amino acids: active transport systems", "Protein metabolism: transamination, deamination, urea cycle", "Protein quality: biological value, PDCAAS", "Nitrogen balance and nutritional significance"],
        hours: 5,
        specificLearningOutcomes: "Describe protein digestion and absorption; explain urea cycle; describe nitrogen balance and protein quality.",
        learningActivities: "Lecture, metabolic pathway exercises.",
        resourcesAndReferences: "Metabolic pathway charts; textbooks.",
        assessmentAndRemarks: "Assignment, oral questions."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Basic Biochemistry",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate mastery of biochemical concepts covered in Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys; lecture manuals.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "26.2.02 Enzymes — Structure, Function, and Regulation",
        subTopics: ["Enzyme structure: apoenzyme, coenzyme, cofactor, prosthetic group", "Enzyme nomenclature and classification: oxidoreductases, transferases, hydrolases, lyases, isomerases, ligases", "Enzyme kinetics: Michaelis-Menten equation, Km and Vmax", "Enzyme inhibition: competitive, non-competitive, uncompetitive", "Allosteric regulation and feedback inhibition"],
        hours: 5,
        specificLearningOutcomes: "Describe enzyme structure and nomenclature; explain Michaelis-Menten kinetics and inhibition types.",
        learningActivities: "Lecture, kinetics graphing exercises.",
        resourcesAndReferences: "Enzyme kinetics graphs; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 10,
        topicTitle: "Fat-Soluble Vitamins in Nutrition",
        subTopics: ["Vitamin A: retinol, carotenoids, functions, deficiency (xerophthalmia), toxicity, food sources", "Vitamin D: cholecalciferol, synthesis, calcium regulation, deficiency (rickets), food sources", "Vitamin E: tocopherols, antioxidant function, deficiency", "Vitamin K: coagulation, deficiency, food sources"],
        hours: 5,
        specificLearningOutcomes: "Describe functions, sources, and deficiency of fat-soluble vitamins A, D, E, and K.",
        learningActivities: "Lecture, vitamin table compilation, case studies.",
        resourcesAndReferences: "Food composition tables; textbooks; charts.",
        assessmentAndRemarks: "Assignment, oral questions."
      },
      {
        weekNumber: 11,
        topicTitle: "Water-Soluble Vitamins in Nutrition",
        subTopics: ["B-vitamins: B1 (beriberi), B2 (angular stomatitis), B3 (pellagra), B5, B6, B7, B9 (neural tube defects), B12 (pernicious anaemia)", "Vitamin C: ascorbic acid, collagen synthesis, scurvy, food sources", "Coenzyme roles of B-vitamins in energy metabolism"],
        hours: 5,
        specificLearningOutcomes: "Describe functions, sources, deficiency diseases of water-soluble vitamins; explain coenzyme roles of B-vitamins.",
        learningActivities: "Lecture, vitamin deficiency case studies.",
        resourcesAndReferences: "Food composition tables; textbooks; charts.",
        assessmentAndRemarks: "Assignment, oral questions."
      },
      {
        weekNumber: 12,
        topicTitle: "Minerals and Trace Elements in Nutrition",
        subTopics: ["Macrominerals: Ca, P, Mg, Na, K, Cl, S", "Trace elements: Fe (iron deficiency anaemia), Zn, I (goitre, cretinism), Se, Cu", "Iron: haem and non-haem, absorption factors, iron deficiency anaemia", "Calcium: bone metabolism, regulation by PTH and calcitonin", "Bioavailability of minerals"],
        hours: 5,
        specificLearningOutcomes: "Describe functions and sources of major minerals and trace elements; explain iron deficiency anaemia and calcium metabolism.",
        learningActivities: "Lecture, mineral deficiency case studies, practical food source analysis.",
        resourcesAndReferences: "Food composition tables; textbooks; charts.",
        assessmentAndRemarks: "Assignment, oral questions."
      },
      {
        weekNumber: 13,
        topicTitle: "26.2.03 Biochemistry Laboratory: Qualitative Analysis",
        subTopics: ["Qualitative tests for carbohydrates: Benedict's test, iodine test, Barfoed's test", "Qualitative tests for proteins: Biuret test, ninhydrin test, Xanthoproteic test", "Qualitative tests for lipids: emulsification test, Sudan III staining", "Qualitative test for Vitamin C: DCPIP test", "Laboratory safety and recording results"],
        hours: 5,
        specificLearningOutcomes: "Carry out qualitative tests for carbohydrates, proteins, and lipids; interpret results; maintain laboratory safety.",
        learningActivities: "Practical laboratory exercises, result recording and analysis.",
        resourcesAndReferences: "Laboratory reagents; test tubes; food samples; equipment.",
        assessmentAndRemarks: "Practical checklist, laboratory report."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Basic Biochemistry",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical examination: qualitative analysis of food samples"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of biochemistry principles and laboratory skills.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; laboratory reagents; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Berg, J. M., Tymoczko, J. L., & Stryer, L. (2019). Biochemistry (9th ed.). W. H. Freeman.",
      "Murray, R. K., et al. (2018). Harper's Illustrated Biochemistry (31st ed.). McGraw-Hill."
    ],
    instructionalEquipment: ["Biochemistry laboratory reagents and equipment", "Test tubes and racks", "Microscopes", "Food samples for testing", "Molecular models", "Whiteboard and LCD projector"]
  },

  "nutrition_in_lifespan": {
    canonicalKey: "nutrition_in_lifespan",
    syllabusCode: "27.2.0",
    unitCode: "27.2.0",
    unitName: "Nutrition in the Lifespan",
    moduleNumber: 2,
    nominalHours: 66,
    theoryHours: 39,
    practicalHours: 27,
    aliases: ["27.2.0", "Nutrition in the Lifespan", "DND 2104", "DHN 2302", "CHN 2204", "Nutrition in the Lifecycle"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge, skills and attitudes in nutrition through the lifespan.",
    overallCompetency: "Explain nutrition through the lifespan; describe nutrient requirements at each life stage; plan appropriate diets for different life stages; counsel individuals and families on optimal nutrition practices.",
    learningOutcomes: [
      "Explain nutrition needs and requirements from preconception through the lifespan",
      "Describe nutrient requirements during pregnancy and lactation",
      "Describe infant and young child feeding practices",
      "Explain nutrition for children and school-age children",
      "Describe nutritional needs of adolescents",
      "Explain nutrition for adults and the elderly"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "27.2.01 Introduction to Nutrition in the Lifespan",
        subTopics: ["Meaning of terms: lifespan, life stage, lifecycle", "Importance of lifecycle approach to nutrition", "Nutritionally vulnerable groups across the lifespan", "Concept of nutrition transition across life stages"],
        hours: 5,
        specificLearningOutcomes: "Define terms; explain lifecycle approach; identify nutritionally vulnerable groups.",
        learningActivities: "Lecture, group discussions, case-based presentations.",
        resourcesAndReferences: "Textbooks; WHO lifecycle nutrition guidelines; charts.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "27.2.02 Nutrition During the Pre-conception Period",
        subTopics: ["Meaning and importance of pre-conception nutrition", "Pre-conception nutrition for women: folate, iron, calcium, iodine", "Pre-conception nutrition for men: zinc, antioxidants, sperm quality", "Effects of pre-conception nutritional status on pregnancy outcomes"],
        hours: 5,
        specificLearningOutcomes: "Explain importance; describe nutrient requirements for pre-conception; explain effects on fertility and early pregnancy.",
        learningActivities: "Lecture, case discussions.",
        resourcesAndReferences: "Textbooks; WHO pre-conception nutrition guidelines.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 3,
        topicTitle: "27.2.03 Nutrition During Pregnancy",
        subTopics: ["Physiological changes during pregnancy", "Nutrient requirements: energy, protein, iron, folate, calcium, iodine, zinc, vitamins A, D, C", "Weight gain recommendations", "Common nutritional problems: anaemia, morning sickness, gestational diabetes", "Dietary assessment and counselling for pregnant women"],
        hours: 5,
        specificLearningOutcomes: "Describe physiological changes and nutrient requirements; identify nutritional problems; plan diets for pregnant women.",
        learningActivities: "Lecture, diet planning practical, case discussions.",
        resourcesAndReferences: "WHO antenatal nutrition guidelines; food composition tables; textbooks.",
        assessmentAndRemarks: "Diet plan submission."
      },
      {
        weekNumber: 4,
        topicTitle: "Nutrition During Lactation",
        subTopics: ["Physiology of lactation: milk production and composition", "Nutrient requirements during lactation: energy, protein, calcium, iodine, vitamin A, fluid", "Exclusive breastfeeding: benefits, duration, technique, positioning", "Breast milk substitutes: risks and International Code regulations"],
        hours: 5,
        specificLearningOutcomes: "Describe lactation physiology and breast milk composition; state nutrient requirements; counsel lactating mothers.",
        learningActivities: "Lecture, breastfeeding counselling practice, diet planning.",
        resourcesAndReferences: "WHO breastfeeding guidelines; UNICEF IYCF resources; textbooks.",
        assessmentAndRemarks: "Counselling demonstration, diet plan."
      },
      {
        weekNumber: 5,
        topicTitle: "Infant Nutrition — Exclusive Breastfeeding (0–6 Months)",
        subTopics: ["Newborn nutritional needs and feeding", "Exclusive breastfeeding (0–6 months): WHO/UNICEF recommendations", "Factors affecting breastfeeding", "Infant formula: composition, preparation, safety", "Low birth weight infant feeding", "Baby-Friendly Hospital Initiative (BFHI)"],
        hours: 5,
        specificLearningOutcomes: "Describe exclusive breastfeeding practices; explain infant formula and LBW feeding options.",
        learningActivities: "Lecture, demonstration, case discussions.",
        resourcesAndReferences: "UNICEF/WHO IYCF guidelines; textbooks.",
        assessmentAndRemarks: "Oral questions, practical demonstration."
      },
      {
        weekNumber: 6,
        topicTitle: "Complementary Feeding and Child Nutrition (6–24 Months)",
        subTopics: ["Complementary feeding: timing, frequency, quality, quantity (WHO IYCF guidelines)", "Introduction of complementary foods: developmentally appropriate, responsive feeding", "Nutrient-dense foods for complementary feeding in Kenya", "Growth monitoring and promotion (GMP)"],
        hours: 5,
        specificLearningOutcomes: "Describe complementary feeding recommendations; plan appropriate complementary foods; describe GMP methods.",
        learningActivities: "Lecture, complementary food preparation practical, growth chart exercise.",
        resourcesAndReferences: "WHO IYCF guidelines; Kenyan food composition tables; textbooks.",
        assessmentAndRemarks: "Food preparation practical, diet plan."
      },
      {
        weekNumber: 7,
        topicTitle: "Nutrition for Children (2–12 Years)",
        subTopics: ["Nutrient requirements for preschool (2–5 years) and school-age children (6–12 years)", "Common nutritional deficiencies: iron, iodine, vitamin A, zinc", "School feeding programmes", "Childhood obesity: risk factors and prevention", "Nutrition counselling for parents and caregivers"],
        hours: 5,
        specificLearningOutcomes: "Describe nutrient requirements; identify common nutritional problems; counsel parents on appropriate nutrition.",
        learningActivities: "Lecture, diet planning exercise, case studies.",
        resourcesAndReferences: "WHO child growth standards; food composition tables; textbooks.",
        assessmentAndRemarks: "Diet plan submission, oral questions."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Nutrition in the Lifespan",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate mastery of lifecycle nutrition concepts from Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys; lecture manuals.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "Adolescent Nutrition",
        subTopics: ["Puberty and growth spurts: nutritional implications", "Nutrient requirements: energy, protein, calcium, iron, zinc, folate", "Adolescent eating behaviours: peer influence, fast food, dieting", "Adolescent nutritional problems: eating disorders, iron deficiency, obesity", "Adolescent pregnancy: nutritional risks"],
        hours: 5,
        specificLearningOutcomes: "Describe nutrient requirements; identify common adolescent nutritional problems; counsel adolescents.",
        learningActivities: "Lecture, case discussions, counselling role play.",
        resourcesAndReferences: "WHO adolescent nutrition guidelines; textbooks.",
        assessmentAndRemarks: "Counselling practical, oral questions."
      },
      {
        weekNumber: 10,
        topicTitle: "Adult Nutrition",
        subTopics: ["Nutrient requirements for adults (19–59 years)", "Physical activity and energy balance", "Diet-related chronic diseases: obesity, hypertension, diabetes, cardiovascular disease", "Dietary guidelines for adults (Kenya)", "Assessment of adult nutritional status"],
        hours: 5,
        specificLearningOutcomes: "Describe nutrient requirements for adults; relate diet to NCD prevention; plan appropriate diets for adults.",
        learningActivities: "Lecture, diet planning exercise, case discussions.",
        resourcesAndReferences: "Kenyan Dietary Guidelines; food composition tables; textbooks.",
        assessmentAndRemarks: "Diet plan submission."
      },
      {
        weekNumber: 11,
        topicTitle: "Geriatric Nutrition — The Elderly",
        subTopics: ["Physiological changes with aging: body composition, GI function, taste, dentition", "Nutrient requirements (60+ years): energy, calcium, vitamin D, protein, B12", "Common nutritional problems: sarcopenia, osteoporosis, dehydration, malnutrition", "Medication-nutrient interactions in the elderly", "Nutritional assessment tools: MNA, MUST"],
        hours: 5,
        specificLearningOutcomes: "Describe aging physiological changes; state nutrient requirements; identify common nutritional problems; describe assessment tools.",
        learningActivities: "Lecture, case studies, diet planning for elderly.",
        resourcesAndReferences: "WHO Healthy Ageing reports; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 12,
        topicTitle: "Sports Nutrition",
        subTopics: ["Energy requirements in sports and physical activity", "Macronutrient needs: carbohydrate loading, protein for muscle repair", "Hydration in sports: water and electrolyte replacement", "Sports supplements: ergogenic aids and safety", "Dietary planning for different sporting activities"],
        hours: 5,
        specificLearningOutcomes: "Describe energy and macronutrient needs in sports; plan diets for different activities; describe safe supplements.",
        learningActivities: "Lecture, sports diet planning exercise.",
        resourcesAndReferences: "IAAF/IOC sports nutrition guidelines; food composition tables.",
        assessmentAndRemarks: "Sports diet plan submission."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in Lifecycle Nutrition",
        subTopics: ["Emerging issues: gut microbiome across the lifespan, epigenetics and nutrition", "Challenges: double burden of malnutrition, urbanisation and dietary change", "Coping strategies: fortification, biofortification, community nutrition interventions", "Technology in lifecycle nutrition monitoring"],
        hours: 5,
        specificLearningOutcomes: "Discuss emerging issues; identify challenges and coping strategies; describe technology applications.",
        learningActivities: "Discussions, presentations, journal article reviews.",
        resourcesAndReferences: "Journal articles; WHO nutrition reports; internet.",
        assessmentAndRemarks: "Oral presentation, assignment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Nutrition in the Lifespan",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical: diet planning case examination across life stages"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of lifecycle nutrition principles.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Mahan, L. K., & Raymond, J. L. (2017). Krause's Food and the Nutrition Care Process (14th ed.). Elsevier.",
      "Ministry of Health, Kenya. (2020). Kenya Dietary Guidelines. Government of Kenya."
    ],
    instructionalEquipment: ["WHO growth charts", "Food composition tables", "Diet planning worksheets", "Growth monitoring equipment", "Whiteboard and LCD projector"]
  },

  "nutrition_and_behaviour": {
    canonicalKey: "nutrition_and_behaviour",
    syllabusCode: "28.2.0",
    unitCode: "28.2.0",
    unitName: "Principles of Nutrition and Behaviour",
    moduleNumber: 2,
    nominalHours: 66,
    theoryHours: 39,
    practicalHours: 27,
    aliases: ["28.2.0", "Principles of Nutrition and Behaviour", "DND 2307", "CHN 2201", "DHN 2305", "DNDT 1202", "Introduction to Behavioral Science", "Principles of Nutrition and Behavior"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills to understand and apply behavioural science principles in nutrition education and counselling.",
    overallCompetency: "Explain the relationship between nutrition and behaviour; apply behavioural science concepts in nutrition education; conduct nutrition counselling; design and evaluate nutrition behaviour change communication.",
    learningOutcomes: [
      "Explain concepts and theories of behaviour and behaviour change",
      "Describe the relationship between diet and brain function and behaviour",
      "Describe effects of nutrients on central nervous system function",
      "Apply behaviour change models in nutrition counselling",
      "Design and implement nutrition education and behaviour change interventions"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "28.2.01 Introduction to Nutrition and Behaviour",
        subTopics: ["Meaning of terms: behaviour, nutrition behaviour, behaviour change", "Scope and importance of behavioural science in nutrition", "Determinants of food choice: biological, psychological, social, cultural, environmental", "The biopsychosocial model of health and nutrition"],
        hours: 5,
        specificLearningOutcomes: "Define terms; explain determinants of food choice; describe scope of behavioural science in nutrition.",
        learningActivities: "Lecture, group discussions, case presentations.",
        resourcesAndReferences: "Behavioural science textbooks; charts; internet.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "28.2.02 Theories of Behaviour and Behaviour Change",
        subTopics: ["Health Belief Model: perceived susceptibility, severity, benefits, barriers, cues to action", "Stages of Change (Transtheoretical) Model: pre-contemplation, contemplation, preparation, action, maintenance", "Social Cognitive Theory: self-efficacy, observational learning", "Theory of Planned Behaviour: attitudes, subjective norms, perceived behavioural control"],
        hours: 5,
        specificLearningOutcomes: "Describe behaviour change theories; apply models to nutrition practice scenarios.",
        learningActivities: "Lecture, case application exercises, group discussions.",
        resourcesAndReferences: "Behavioural science textbooks; case study portfolios.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 3,
        topicTitle: "28.2.03 Research Methods in Nutrition and Behaviour",
        subTopics: ["Qualitative research: interviews, focus group discussions, ethnography", "Quantitative approaches: surveys, dietary assessment tools", "Experimental approaches in behaviour change research", "Ethical considerations in behavioural research"],
        hours: 5,
        specificLearningOutcomes: "Describe research methods; differentiate qualitative and quantitative approaches; explain ethical considerations.",
        learningActivities: "Lecture, research design exercise.",
        resourcesAndReferences: "Research methods textbooks; journal articles.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 4,
        topicTitle: "28.2.04 Direct Effects of Diet on Brain Function and Behaviour",
        subTopics: ["The central nervous system and nutrition: key neurotransmitters (serotonin, dopamine, norepinephrine)", "Role of glucose in brain function and cognitive performance", "Effects of nutritional deficiencies on mental function: iron, iodine, zinc, omega-3 fatty acids", "Diet and mental health: depression, anxiety, and cognitive decline"],
        hours: 5,
        specificLearningOutcomes: "Explain role of key nutrients in CNS function; describe effects of nutritional deficiencies on behaviour and cognition.",
        learningActivities: "Lecture, case studies on nutritional deficiencies and behaviour.",
        resourcesAndReferences: "Textbooks; journal articles on diet and brain function.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 5,
        topicTitle: "28.2.05 Nutrients and the Central Nervous System",
        subTopics: ["B-vitamins and neurotransmitter synthesis: B1, B2, B3, B6, B9, B12", "Omega-3 fatty acids: DHA, EPA, and brain structure", "Alcohol and the brain: neurological effects of chronic alcohol consumption", "Depressants, stimulants, and substance abuse: nutritional consequences"],
        hours: 5,
        specificLearningOutcomes: "Describe roles of B-vitamins in neurotransmitter synthesis; explain role of omega-3 fatty acids; describe neurological effects of alcohol.",
        learningActivities: "Lecture, case studies on B-vitamin deficiency and behaviour.",
        resourcesAndReferences: "Textbooks; journal articles.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 6,
        topicTitle: "Nutrition Counselling — Principles and Communication Skills",
        subTopics: ["Principles of effective nutrition counselling", "Communication skills: active listening, verbal and non-verbal communication, empathy", "Counselling models: FRAMES", "Motivational interviewing in nutrition counselling", "Counselling skills practice: open-ended questions, reflective listening"],
        hours: 5,
        specificLearningOutcomes: "Describe principles of nutrition counselling; apply communication skills; demonstrate motivational interviewing.",
        learningActivities: "Role play counselling sessions, peer feedback.",
        resourcesAndReferences: "Counselling manuals; textbooks; role play scenarios.",
        assessmentAndRemarks: "Role play assessment, peer evaluation."
      },
      {
        weekNumber: 7,
        topicTitle: "Nutrition Education — Principles and Methods",
        subTopics: ["Principles of effective nutrition education", "Nutrition education methods: individual, group, and community", "Visual aids: posters, flip charts, food models, demonstrations", "Developing SBCC nutrition messages", "Planning a nutrition education session"],
        hours: 5,
        specificLearningOutcomes: "Describe nutrition education methods; develop visual aids; plan and conduct a nutrition education session.",
        learningActivities: "Lecture, visual aid design practical, session planning.",
        resourcesAndReferences: "Visual aid materials; textbooks; FAO nutrition education resources.",
        assessmentAndRemarks: "Nutrition education plan, practical demonstration."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Nutrition and Behaviour",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate mastery of topics from Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys; lecture manuals.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "Nutrition and Social-Cultural Factors",
        subTopics: ["Food taboos and beliefs across Kenyan communities", "Cultural practices affecting infant and child feeding", "Religious dietary laws and nutritional implications", "Gender and nutrition: women's autonomy and nutritional outcomes", "Poverty, food insecurity, and behavioural responses to hunger"],
        hours: 5,
        specificLearningOutcomes: "Describe cultural and social factors influencing food behaviour; discuss gender and food security implications.",
        learningActivities: "Group discussions, community case studies, presentations.",
        resourcesAndReferences: "FAO social marketing resources; community case studies.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 10,
        topicTitle: "Food Advertising, Media Influence, and Consumer Behaviour",
        subTopics: ["Impact of food advertising and marketing on food choice", "Social media and digital nutrition communication", "Consumer behaviour and food purchasing decisions", "Food labelling and informed consumer choice", "Critical analysis of food marketing"],
        hours: 5,
        specificLearningOutcomes: "Describe impact of food advertising; critically analyze marketing messages; explain consumer food purchasing behaviour.",
        learningActivities: "Lecture, food advertisement analysis practical.",
        resourcesAndReferences: "Food labels; advertising samples; regulatory resources.",
        assessmentAndRemarks: "Advertising analysis exercise."
      },
      {
        weekNumber: 11,
        topicTitle: "Behaviour Change Communication (BCC) Programme Design",
        subTopics: ["Steps in designing a BCC programme: needs assessment, target audience, goals, messages, channels, evaluation", "Developing SMART nutrition BCC objectives", "Communication channels: mass media, interpersonal, social media", "Developing culturally appropriate BCC materials"],
        hours: 5,
        specificLearningOutcomes: "Describe steps in BCC programme design; develop SMART objectives; design culturally appropriate materials.",
        learningActivities: "Lecture, BCC programme design group exercise.",
        resourcesAndReferences: "USAID BCC guidelines; UNICEF SBCC resources.",
        assessmentAndRemarks: "BCC programme plan submission."
      },
      {
        weekNumber: 12,
        topicTitle: "Practical Nutrition Counselling and Education Sessions",
        subTopics: ["Planning and conducting a one-on-one nutrition counselling session", "Group nutrition education session facilitation", "Documentation and record keeping in nutrition counselling", "Referral pathways in nutrition counselling"],
        hours: 5,
        specificLearningOutcomes: "Conduct one-on-one counselling sessions; facilitate group education; document sessions and make referrals.",
        learningActivities: "Role play counselling and education practicals, peer evaluation.",
        resourcesAndReferences: "Counselling role play scenarios; flip charts; food models.",
        assessmentAndRemarks: "Role play assessment, peer evaluation."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in Nutrition and Behaviour",
        subTopics: ["Emerging issues: digital health tools and nutrition behaviour, food environment modification", "Gut-brain axis and nutritional relevance", "Mindful eating and intuitive eating approaches", "Challenges posed by ultra-processed food environments", "Coping strategies: nudging, environment redesign, policy interventions"],
        hours: 5,
        specificLearningOutcomes: "Discuss emerging issues; describe gut-brain axis; identify coping strategies.",
        learningActivities: "Presentations, discussions, journal reviews.",
        resourcesAndReferences: "Journal articles; WHO nutrition behaviour reports.",
        assessmentAndRemarks: "Oral presentation, assignment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Nutrition and Behaviour",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical: nutrition counselling or education session demonstration"],
        hours: 5,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of nutrition behaviour principles and counselling skills.",
        learningActivities: "Supervised theory examination and practical counselling assessment.",
        resourcesAndReferences: "Official examination papers; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Glanz, K., Rimer, B. K., & Viswanath, K. (Eds.). (2015). Health Behavior: Theory, Research, and Practice (5th ed.). Jossey-Bass.",
      "FAO. (2014). Nutrition Education and Consumer Awareness. Food and Agriculture Organization."
    ],
    instructionalEquipment: ["Flip charts and markers", "Food models", "Visual aids", "Counselling role-play scenario cards", "Whiteboard and LCD projector"]
  },

  "primary_health_care": {
    canonicalKey: "primary_health_care",
    syllabusCode: "29.2.0",
    unitCode: "29.2.0",
    unitName: "Introduction to Primary Health Care",
    moduleNumber: 2,
    nominalHours: 44,
    theoryHours: 26,
    practicalHours: 18,
    aliases: ["29.2.0", "Introduction to Primary Health Care", "CND 1307", "DND 1307", "DHN 2207", "CHN 1305"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills to understand and participate in primary health care delivery.",
    overallCompetency: "Explain the concept of PHC; identify components of PHC; apply nutrition interventions within the PHC system; participate in community-based health and nutrition programmes.",
    learningOutcomes: [
      "Explain the background and concept of primary health care",
      "Describe components of PHC in Kenya",
      "Describe the Kenya health care system and referral pathway",
      "Explain community-based health care approaches",
      "Apply nutrition and health interventions within the PHC framework"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "29.2.01 Background of Primary Health Care",
        subTopics: ["Definition of terms: primary health care, health, disease, illness, wellness", "Historical background: Alma-Ata Declaration (1978)", "Principles of PHC: accessibility, equity, community participation, intersectoral collaboration, appropriate technology", "Evolution of PHC globally and in Africa"],
        hours: 3,
        specificLearningOutcomes: "Define terms; describe history of PHC including Alma-Ata; explain PHC principles.",
        learningActivities: "Lecture, group discussions, case presentations.",
        resourcesAndReferences: "PHC textbooks; WHO Alma-Ata Declaration; charts.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "29.2.02 Components of Primary Health Care",
        subTopics: ["Eight essential components of PHC (Alma-Ata): nutrition, safe water, sanitation, MCH, immunization, essential drugs, communicable disease control, health education", "Nutrition as a key component of PHC", "Kenya's PHC priorities", "Universal Health Coverage (UHC) and PHC"],
        hours: 3,
        specificLearningOutcomes: "Identify and describe PHC components; explain nutrition's role in PHC; describe Kenya's PHC priorities.",
        learningActivities: "Lecture, group discussions, field study at a health facility.",
        resourcesAndReferences: "Kenya Health Sector Strategy; PHC textbooks.",
        assessmentAndRemarks: "Oral questions, field study report."
      },
      {
        weekNumber: 3,
        topicTitle: "The Kenya Health Care System",
        subTopics: ["Levels of the Kenya health care system: community, dispensary, health centre, sub-district hospital, county referral, national referral", "Referral pathway and patient flow", "Community health volunteers (CHVs): roles and functions", "Role of nutrition in the Kenya health system"],
        hours: 3,
        specificLearningOutcomes: "Describe levels of Kenya health system; explain referral pathway; describe CHV roles.",
        learningActivities: "Lecture, field study at health facility.",
        resourcesAndReferences: "Kenya Health Sector Strategic Plan; field study guides.",
        assessmentAndRemarks: "Field study report, oral questions."
      },
      {
        weekNumber: 4,
        topicTitle: "Community Health and Community Diagnosis",
        subTopics: ["Meaning of community health and community diagnosis", "Methods: surveys, focus groups, observation, health records review", "Community health needs assessment process", "Community health profiles: demographics, epidemiology, nutrition status"],
        hours: 3,
        specificLearningOutcomes: "Define community health and diagnosis; describe methods; conduct simple community health needs assessment.",
        learningActivities: "Lecture, community visit, mini-survey exercise.",
        resourcesAndReferences: "Community diagnosis manuals; survey tools; textbooks.",
        assessmentAndRemarks: "Community diagnosis report."
      },
      {
        weekNumber: 5,
        topicTitle: "29.2.04 Maternal and Child Health Services in PHC",
        subTopics: ["Antenatal care: visits, assessments, supplementation, birth preparedness", "Delivery services and skilled birth attendance", "Postnatal care: maternal and newborn follow-up", "Child health services: immunization, IMCI, growth monitoring"],
        hours: 3,
        specificLearningOutcomes: "Describe MCH services within PHC; explain antenatal and postnatal care; describe child health services.",
        learningActivities: "Lecture, MCH clinic attachment, discussions.",
        resourcesAndReferences: "Kenya MNCH guidelines; MCH textbooks.",
        assessmentAndRemarks: "Oral questions, clinical observation report."
      },
      {
        weekNumber: 6,
        topicTitle: "Communicable Disease Control in PHC",
        subTopics: ["Major communicable diseases: malaria, TB, HIV/AIDS, diarrhoeal diseases, pneumonia", "Integrated management of childhood illness (IMCI)", "Immunization programme in Kenya: EPI schedule and vaccines", "Nutritional aspects of communicable disease management"],
        hours: 3,
        specificLearningOutcomes: "Describe major communicable diseases and control; explain Kenya EPI schedule; discuss nutritional aspects of disease management.",
        learningActivities: "Lecture, immunization clinic attachment.",
        resourcesAndReferences: "Kenya EPI guidelines; IMCI manuals; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 7,
        topicTitle: "29.2.06 Nutrition in Primary Health Care",
        subTopics: ["Nutrition interventions in PHC: supplementation, growth monitoring, CMAM", "Integrated nutrition services in MCH clinics: IYCF, micronutrient supplementation, vitamin A", "Nutrition screening tools: MUAC, weight-for-height, MUST", "Nutrition referral pathways", "Community nutrition programmes: kitchen gardens, nutrition demonstrations"],
        hours: 3,
        specificLearningOutcomes: "Describe nutrition interventions in PHC; explain CMAM; apply nutrition screening tools.",
        learningActivities: "Lecture, CMAM clinic attachment, MUAC screening practical.",
        resourcesAndReferences: "Kenya CMAM guidelines; nutrition screening tools; textbooks.",
        assessmentAndRemarks: "Practical screening exercise, report."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Introduction to Primary Health Care",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 3,
        specificLearningOutcomes: "Demonstrate mastery of PHC concepts from Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys; lecture manuals.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "29.2.05 Community-Based Health and Nutrition Programmes",
        subTopics: ["Community-based nutrition programmes: school nutrition, supplementary feeding", "Home-based care for chronic conditions: HIV, TB, cancer", "Community health education and promotion", "Community mobilization for health and nutrition", "Linkages between community structures and health facilities"],
        hours: 3,
        specificLearningOutcomes: "Describe community-based nutrition programmes; explain home-based care; apply community mobilization.",
        learningActivities: "Lecture, community programme visit.",
        resourcesAndReferences: "Community nutrition programme manuals; field visit guides.",
        assessmentAndRemarks: "Community programme visit report."
      },
      {
        weekNumber: 10,
        topicTitle: "Non-Communicable Disease Prevention in PHC",
        subTopics: ["Prevention and control of NCDs: hypertension, diabetes, cancer, cardiovascular disease", "Risk factor screening: BMI, blood pressure, blood glucose", "Lifestyle modification counselling: diet, physical activity, smoking cessation", "Community-based NCD prevention programmes"],
        hours: 3,
        specificLearningOutcomes: "Describe NCD prevention in PHC; apply risk factor screening tools; counsel on lifestyle modifications.",
        learningActivities: "Lecture, practical risk factor screening, counselling role play.",
        resourcesAndReferences: "Kenya NCD strategy; WHO NCD guidelines.",
        assessmentAndRemarks: "Practical screening exercise, counselling role play."
      },
      {
        weekNumber: 11,
        topicTitle: "Water, Sanitation, Hygiene (WASH) and Health",
        subTopics: ["Safe water: sources, treatment methods (chlorination, boiling, filtration, solar disinfection)", "Sanitation: types of latrines, open defecation elimination", "Hygiene: handwashing at critical times, food hygiene", "WASH and nutritional outcomes: diarrhoea, stunting, malnutrition"],
        hours: 3,
        specificLearningOutcomes: "Describe safe water treatment methods; explain sanitation and hygiene practices; describe WASH-nutrition nexus.",
        learningActivities: "Lecture, water treatment practical demonstration.",
        resourcesAndReferences: "WASH guidelines; Kenya WASH policy; textbooks.",
        assessmentAndRemarks: "Practical exercise, oral questions."
      },
      {
        weekNumber: 12,
        topicTitle: "Health Information Systems in PHC",
        subTopics: ["Types of health records in PHC", "Kenya Health Information System (KHIS): data collection, entry, reporting", "Key health and nutrition indicators for monitoring", "Confidentiality and ethical use of health data"],
        hours: 3,
        specificLearningOutcomes: "Describe health records in PHC; explain KHIS; identify key health and nutrition indicators.",
        learningActivities: "Lecture, health records review exercise.",
        resourcesAndReferences: "KHIS manuals; health records samples.",
        assessmentAndRemarks: "Health records exercise, oral questions."
      },
      {
        weekNumber: 13,
        topicTitle: "29.2.07 Emerging Issues and Trends in Primary Health Care",
        subTopics: ["Emerging issues: UHC, digital health, telemedicine in PHC", "Climate change and health: nutritional implications", "Challenges: task shifting, community empowerment", "Ways of coping with challenges"],
        hours: 3,
        specificLearningOutcomes: "Discuss emerging issues in PHC; describe digital health applications; explain coping strategies.",
        learningActivities: "Discussions, presentations, journal reviews.",
        resourcesAndReferences: "WHO UHC reports; digital health resources.",
        assessmentAndRemarks: "Oral presentation, assignment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Introduction to Primary Health Care",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical: community health and nutrition activity demonstration"],
        hours: 3,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of PHC principles and community nutrition practice.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "WHO. (2018). Primary Health Care: Transforming Vision into Action. World Health Organization.",
      "Ministry of Health, Kenya. (2018). Kenya Health Sector Strategic Plan 2018–2023. Government of Kenya."
    ],
    instructionalEquipment: ["MUAC tapes", "Weighing scales", "Growth charts", "Community health education materials", "Whiteboard and LCD projector"]
  },

  "first_aid": {
    canonicalKey: "first_aid",
    syllabusCode: "30.2.0",
    unitCode: "30.2.0",
    unitName: "First Aid",
    moduleNumber: 2,
    nominalHours: 55,
    theoryHours: 33,
    practicalHours: 22,
    aliases: ["30.2.0", "First Aid", "DCU 1104", "DND 2107", "DNDT 1101"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills to administer appropriate first aid to casualties in emergency situations.",
    overallCompetency: "Explain principles of first aid; assess and manage a casualty; manage wounds, burns and scalds; provide CPR; manage common medical emergencies.",
    learningOutcomes: [
      "Explain meaning of terms and importance of first aid",
      "Carry out casualty assessment and management",
      "Manage wounds, burns, and scalds",
      "Administer CPR and manage airway obstruction",
      "Manage fractures, dislocations, and sprains",
      "Manage common medical emergencies"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "30.2.01 Introduction to First Aid",
        subTopics: ["Meaning of terms: first aid, casualty, emergency", "Aims and importance of first aid", "Qualities and responsibilities of a first aider", "Legal considerations: consent, duty of care", "The first aid kit: contents and uses", "Scene safety and primary survey: DRABC (Danger, Response, Airway, Breathing, Circulation)"],
        hours: 4,
        specificLearningOutcomes: "Define terms; explain aims of first aid; describe first aid kit contents; apply DRABC.",
        learningActivities: "Lecture, first aid kit demonstration, group discussions.",
        resourcesAndReferences: "First aid textbooks; first aid kits; charts.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "Casualty Assessment — Primary and Secondary Survey",
        subTopics: ["Primary survey: ABCDE approach (Airway, Breathing, Circulation, Disability, Exposure)", "Level of consciousness: AVPU scale", "Secondary survey: head-to-toe examination", "Recording vital signs: pulse rate, respiratory rate, blood pressure, temperature", "Positioning the casualty: recovery position, shock position"],
        hours: 4,
        specificLearningOutcomes: "Apply ABCDE primary survey; assess consciousness using AVPU; carry out secondary survey and vital signs recording.",
        learningActivities: "Practical casualty assessment simulations.",
        resourcesAndReferences: "Manikins; vital signs equipment; first aid textbooks.",
        assessmentAndRemarks: "Practical simulation assessment."
      },
      {
        weekNumber: 3,
        topicTitle: "Cardiopulmonary Resuscitation (CPR) and AED",
        subTopics: ["Cardiac arrest: recognition and causes", "Chain of survival: early recognition, CPR, defibrillation, advanced care", "Adult CPR: chest compressions and rescue breaths (30:2)", "Infant and child CPR modifications", "AED use and safety", "Airway obstruction: Heimlich maneuver, back blows"],
        hours: 4,
        specificLearningOutcomes: "Recognize cardiac arrest; perform CPR on adults, children, infants; demonstrate AED use; apply Heimlich maneuver.",
        learningActivities: "Practical CPR on manikins, AED demonstration.",
        resourcesAndReferences: "CPR manikins; AED trainer; first aid textbooks.",
        assessmentAndRemarks: "Practical CPR skills checklist."
      },
      {
        weekNumber: 4,
        topicTitle: "30.2.02 Managing Wounds, Bleeding, and Shock",
        subTopics: ["Types of wounds: cuts, lacerations, puncture wounds, abrasions, contusions, amputations", "Management of external bleeding: direct pressure, elevation, pressure points", "Internal bleeding: recognition and emergency management", "Wound dressing techniques: sterile technique", "Types of shock and management"],
        hours: 4,
        specificLearningOutcomes: "Classify wounds; manage external bleeding; apply wound dressings; recognize and manage shock.",
        learningActivities: "Practical wound dressing and bleeding control exercises.",
        resourcesAndReferences: "First aid supplies; wound care equipment.",
        assessmentAndRemarks: "Practical wound management assessment."
      },
      {
        weekNumber: 5,
        topicTitle: "Burns, Scalds, and Electrical Injuries",
        subTopics: ["Classification of burns: superficial, partial thickness, full thickness", "Causes: thermal, chemical, electrical, radiation", "Assessment of burn severity: Rule of Nines, palm method", "Management: cooling, covering, fluid resuscitation principles", "Chemical burns: decontamination", "Electrical injuries: dangers and management"],
        hours: 4,
        specificLearningOutcomes: "Classify burns by degree; assess severity using Rule of Nines; manage burns, scalds, and electrical injuries.",
        learningActivities: "Lecture, burn management simulation, case studies.",
        resourcesAndReferences: "First aid textbooks; burn management charts.",
        assessmentAndRemarks: "Practical simulation, oral questions."
      },
      {
        weekNumber: 6,
        topicTitle: "Fractures, Dislocations, Sprains, and Strains",
        subTopics: ["Types of fractures: open (compound) and closed", "Recognition of fractures: signs and symptoms", "Fracture management: immobilization, splinting, sling application", "Management of dislocations: do's and don'ts", "Sprains and strains: RICE (Rest, Ice, Compression, Elevation)", "Spinal injury precautions"],
        hours: 4,
        specificLearningOutcomes: "Classify fractures; apply splints and slings; manage dislocations and sprains; apply spinal precautions.",
        learningActivities: "Practical splinting and bandaging exercises.",
        resourcesAndReferences: "Splints; bandages; slings; first aid textbooks.",
        assessmentAndRemarks: "Practical splinting assessment."
      },
      {
        weekNumber: 7,
        topicTitle: "Medical Emergencies",
        subTopics: ["Diabetic emergencies: hypoglycaemia and DKA management", "Allergic reactions and anaphylaxis: recognition, epinephrine", "Seizures and epilepsy: management during a seizure", "Stroke: FAST recognition and management", "Asthma attacks: recognition and management", "Poisoning: ingested, inhaled, skin contact"],
        hours: 4,
        specificLearningOutcomes: "Manage diabetic emergencies; recognize and manage anaphylaxis; apply seizure protocols; recognize stroke using FAST.",
        learningActivities: "Lecture, simulation exercises, case studies.",
        resourcesAndReferences: "Medical emergency simulation equipment.",
        assessmentAndRemarks: "Simulation exercise, oral questions."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — First Aid",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 4,
        specificLearningOutcomes: "Demonstrate mastery of first aid concepts from Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "First Aid in Special Environments",
        subTopics: ["First aid in the laboratory: chemical exposure, eye injuries", "First aid in the kitchen: cuts, scalds, burns", "First aid in sports and exercise settings", "Mass casualty events: triage principles (START triage)", "Nutritional first aid: ORS preparation and administration"],
        hours: 4,
        specificLearningOutcomes: "Apply first aid in specific environments; describe triage principles; administer ORS in nutritional emergencies.",
        learningActivities: "Simulation exercises, ORS preparation practical.",
        resourcesAndReferences: "First aid textbooks; ORS preparation materials.",
        assessmentAndRemarks: "Simulation, practical exercise."
      },
      {
        weekNumber: 10,
        topicTitle: "Environmental Emergencies",
        subTopics: ["Heat-related illnesses: heat cramps, heat exhaustion, heat stroke — recognition and management", "Cold-related injuries: hypothermia, frostbite — recognition and management", "Near-drowning and submersion injuries", "Envenomation: snake bites, insect stings — first aid management"],
        hours: 4,
        specificLearningOutcomes: "Recognize and manage heat and cold emergencies; apply near-drowning management; describe envenomation first aid.",
        learningActivities: "Lecture, simulation exercises.",
        resourcesAndReferences: "First aid textbooks; emergency management case studies.",
        assessmentAndRemarks: "Simulation, oral questions."
      },
      {
        weekNumber: 11,
        topicTitle: "Obstetric and Paediatric Emergencies",
        subTopics: ["Emergency childbirth: managing unexpected delivery", "Neonatal resuscitation: basic steps", "Paediatric emergencies: febrile convulsions, neonatal jaundice", "Nutritional emergencies in children: SAM first aid protocol, ORS"],
        hours: 4,
        specificLearningOutcomes: "Manage unexpected delivery; perform neonatal resuscitation; apply first aid for paediatric nutritional emergencies.",
        learningActivities: "Simulation exercises, neonatal manikin practical.",
        resourcesAndReferences: "Obstetric first aid manuals; neonatal manikins.",
        assessmentAndRemarks: "Simulation, practical assessment."
      },
      {
        weekNumber: 12,
        topicTitle: "Mental Health First Aid",
        subTopics: ["Introduction to mental health first aid", "Recognizing mental health crises: panic attacks, psychotic episodes, suicidal ideation", "ALGEE action plan", "First aid for stress, grief, and trauma", "Nutrition and mental health connection"],
        hours: 4,
        specificLearningOutcomes: "Define mental health first aid; recognize crisis presentations; apply the ALGEE action plan.",
        learningActivities: "Lecture, role play exercises.",
        resourcesAndReferences: "Mental Health First Aid resources; textbooks.",
        assessmentAndRemarks: "Role play, oral questions."
      },
      {
        weekNumber: 13,
        topicTitle: "30.2.07 Emerging Issues and Trends in First Aid",
        subTopics: ["Emerging issues: digital health and first aid apps, community first responders", "Challenges: bystander hesitation, legal liability", "Stop the Bleed campaign and tourniquet application", "Future of first aid: technology integration"],
        hours: 4,
        specificLearningOutcomes: "Discuss emerging first aid trends; apply tourniquet technique; describe technology integration.",
        learningActivities: "Presentations, tourniquet practical.",
        resourcesAndReferences: "Stop the Bleed resources; tourniquets.",
        assessmentAndRemarks: "Tourniquet practical, oral questions."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — First Aid",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical: CPR, wound management, fracture immobilization scenarios"],
        hours: 4,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of first aid theory and practical skills.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; first aid equipment; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "St John Ambulance, British Red Cross. (2021). First Aid Manual (11th ed.). Dorling Kindersley.",
      "Kenya Red Cross Society. (2019). Community Based First Aid Training Manual. KRCS."
    ],
    instructionalEquipment: ["CPR manikins (adult, child, infant)", "AED trainer", "First aid kits", "Splints and bandages", "Wound dressing supplies", "Whiteboard and LCD projector"]
  },

  "business_plan": {
    canonicalKey: "business_plan",
    syllabusCode: "31.2.0",
    unitCode: "31.2.0",
    unitName: "Business Plan",
    moduleNumber: 2,
    nominalHours: 44,
    theoryHours: 26,
    practicalHours: 18,
    aliases: ["31.2.0", "Business Plan"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills to develop and implement a business plan in nutrition and dietetics practice.",
    overallCompetency: "Identify and evaluate business opportunities; develop a comprehensive business plan; manage finances; present a business plan to stakeholders.",
    learningOutcomes: [
      "Identify features of a business and a business opportunity",
      "Develop a comprehensive business plan",
      "Describe business organization and management",
      "Prepare financial projections and documents",
      "Market and promote a nutrition-based product or service",
      "Present a completed business plan"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "31.2.01 Introduction to Business and Business Planning",
        subTopics: ["Meaning of terms: business, business plan, enterprise, entrepreneur", "Importance of a business plan in nutrition practice", "Characteristics of a good business plan", "Types of businesses in nutrition: catering, clinical nutrition, food production, consulting", "Identifying a business opportunity: market needs, gap analysis", "Guidelines for developing a business plan"],
        hours: 3,
        specificLearningOutcomes: "Define terms; explain importance; identify business opportunities in nutrition; describe guidelines for business plan.",
        learningActivities: "Lecture, group brainstorming, case presentations.",
        resourcesAndReferences: "Entrepreneurship textbooks; business plan samples.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "Business Opportunity Identification and Analysis",
        subTopics: ["Identifying features of a business opportunity", "PESTLE analysis: Political, Economic, Social, Technical, Legal, Environmental", "Market research: target customers, demand estimation", "SWOT analysis: Strengths, Weaknesses, Opportunities, Threats", "Feasibility assessment of a business idea"],
        hours: 3,
        specificLearningOutcomes: "Identify and evaluate features of a business opportunity; apply PESTLE and SWOT analyses; assess feasibility.",
        learningActivities: "Lecture, SWOT analysis exercise, group discussions.",
        resourcesAndReferences: "Business plan textbooks; SWOT analysis templates.",
        assessmentAndRemarks: "SWOT analysis submission."
      },
      {
        weekNumber: 3,
        topicTitle: "31.2.02 Business Name, Legal Registration, and Organizational Structure",
        subTopics: ["Business name selection and branding", "Legal forms of business: sole proprietorship, partnership, limited company, cooperative", "Business registration in Kenya: BRS, KRA, county requirements", "Organizational structure: hierarchical, flat, matrix", "Human resource planning: staffing needs, job descriptions, remuneration"],
        hours: 3,
        specificLearningOutcomes: "Select appropriate business name and legal form; describe registration process; design organizational structure.",
        learningActivities: "Lecture, business registration exercise, organizational chart design.",
        resourcesAndReferences: "Business registration forms; Kenya Companies Act.",
        assessmentAndRemarks: "Organizational chart submission."
      },
      {
        weekNumber: 4,
        topicTitle: "Executive Summary and Business Description",
        subTopics: ["Components of executive summary: business name, vision, mission, products/services, financial projections", "Business description: background, location, facilities", "Vision and mission statement development", "Business goals and SMART objectives", "Business values and ethics statement"],
        hours: 3,
        specificLearningOutcomes: "Write an executive summary; develop business description, vision, mission; formulate SMART objectives.",
        learningActivities: "Guided business plan writing workshop.",
        resourcesAndReferences: "Business plan templates; sample business plans.",
        assessmentAndRemarks: "Executive summary and business description submission."
      },
      {
        weekNumber: 5,
        topicTitle: "Market Analysis and Marketing Plan",
        subTopics: ["Market analysis: target market, market size, segmentation", "Marketing mix (4Ps): Product, Price, Place, Promotion", "Pricing strategies: cost-based, value-based, competitive", "Promotion methods: advertising, social media, community outreach", "Distribution channels for nutrition products and services"],
        hours: 3,
        specificLearningOutcomes: "Conduct market analysis; develop marketing plan using 4Ps; design pricing and promotion strategies.",
        learningActivities: "Lecture, marketing plan group project.",
        resourcesAndReferences: "Marketing textbooks; sample marketing plans.",
        assessmentAndRemarks: "Marketing plan submission."
      },
      {
        weekNumber: 6,
        topicTitle: "Operational Plan and Production Plan",
        subTopics: ["Operational plan: daily operations, workflow, production process", "Facilities and equipment requirements", "Suppliers and procurement", "Quality control in nutrition food production", "Regulatory compliance: food safety, health certificates, KEBS standards"],
        hours: 3,
        specificLearningOutcomes: "Develop operational and production plan; identify facility and equipment requirements; describe regulatory compliance.",
        learningActivities: "Lecture, operational plan design exercise.",
        resourcesAndReferences: "KEBS food safety standards; equipment catalogues.",
        assessmentAndRemarks: "Operational plan submission."
      },
      {
        weekNumber: 7,
        topicTitle: "Financial Planning — Start-up Costs and Revenue Projections",
        subTopics: ["Start-up costs: capital expenditure and working capital", "Sources of business financing: savings, loans, grants, microfinance", "Revenue projection: pricing model, sales forecast, break-even analysis", "Cash flow projection", "Profit and loss statement; balance sheet"],
        hours: 3,
        specificLearningOutcomes: "Calculate start-up costs; prepare revenue projections and break-even analysis; draft cash flow and P&L statement.",
        learningActivities: "Lecture, financial calculation exercises.",
        resourcesAndReferences: "Financial planning templates; business plan textbooks.",
        assessmentAndRemarks: "Financial projection submission."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Business Plan",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 3,
        specificLearningOutcomes: "Demonstrate mastery of business planning concepts from Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "Record Keeping and Business Accounting",
        subTopics: ["Importance of record keeping in business", "Types of business records: sales, stock, receipts, invoices, employee records", "Simple accounting: petty cash, bank reconciliation", "Use of accounting software for small businesses", "Tax obligations in Kenya: PIN, VAT"],
        hours: 3,
        specificLearningOutcomes: "Describe importance of record keeping; maintain basic business records; describe tax obligations.",
        learningActivities: "Lecture, record keeping practical exercise.",
        resourcesAndReferences: "Business accounting templates; KRA guides.",
        assessmentAndRemarks: "Record keeping practical, oral questions."
      },
      {
        weekNumber: 10,
        topicTitle: "Risk Management and Business Continuity",
        subTopics: ["Types of business risks: financial, operational, market, legal, reputational", "Risk identification and assessment tools", "Risk mitigation: insurance, diversification, contingency planning", "Business continuity planning", "Food safety risks and crisis management"],
        hours: 3,
        specificLearningOutcomes: "Identify and assess business risks; develop risk mitigation strategies; describe business continuity planning.",
        learningActivities: "Lecture, risk assessment exercise.",
        resourcesAndReferences: "Business risk management textbooks.",
        assessmentAndRemarks: "Risk management plan submission."
      },
      {
        weekNumber: 11,
        topicTitle: "Business Ethics, Social Responsibility, and Sustainability",
        subTopics: ["Business ethics: professional conduct, consumer rights, fair competition", "Corporate social responsibility (CSR): community nutrition programmes, environmental sustainability", "Green business practices", "Nutrition business ethics: avoiding misinformation and quackery"],
        hours: 3,
        specificLearningOutcomes: "Describe business ethics; explain CSR; identify sustainability practices for nutrition businesses.",
        learningActivities: "Lecture, case studies, group discussions.",
        resourcesAndReferences: "Business ethics textbooks; Kenya Labour Laws.",
        assessmentAndRemarks: "Case study analysis, oral questions."
      },
      {
        weekNumber: 12,
        topicTitle: "Compiling the Complete Business Plan Document",
        subTopics: ["Standard business plan format: executive summary, company overview, market analysis, organization, operations, marketing plan, financial plan, appendices", "Writing each section cohesively", "Designing a professional document: formatting, charts, tables", "Review and revision of complete business plan"],
        hours: 3,
        specificLearningOutcomes: "Compile all sections into a complete, coherent business plan; format professionally.",
        learningActivities: "Guided business plan compilation workshop.",
        resourcesAndReferences: "Business plan templates; formatting guides.",
        assessmentAndRemarks: "Draft complete business plan submission."
      },
      {
        weekNumber: 13,
        topicTitle: "31.2.07 Business Plan Presentation and Pitch",
        subTopics: ["Preparing a business plan pitch: key highlights, investor perspective", "Presentation skills: body language, voice projection, visual aids", "Use of PowerPoint in business presentations", "Responding to investor and panel questions", "Practice presentations and peer feedback"],
        hours: 3,
        specificLearningOutcomes: "Prepare and deliver a persuasive business plan pitch; use visual aids; respond to panel questions.",
        learningActivities: "Business plan presentation rehearsals, peer feedback.",
        resourcesAndReferences: "Presentation slides; projector.",
        assessmentAndRemarks: "Presentation rehearsal, peer evaluation."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Business Plan Submission and Formal Presentation",
        subTopics: ["Final submission of completed business plan document", "Formal business plan presentation to academic panel", "Panel evaluation using standardized marking rubric", "Feedback and reflection on business planning process"],
        hours: 3,
        specificLearningOutcomes: "Submit complete business plan; present persuasively to formal panel.",
        learningActivities: "Formal business plan presentation and submission.",
        resourcesAndReferences: "Business plan evaluation rubric.",
        assessmentAndRemarks: "Final business plan evaluation."
      }
    ],
    references: [
      "Hisrich, R. D., Peters, M. P., & Shepherd, D. A. (2017). Entrepreneurship (10th ed.). McGraw-Hill.",
      "Kenya Revenue Authority. (2022). Business Registration and Tax Guide. KRA."
    ],
    instructionalEquipment: ["Projector and laptop", "Business plan templates", "Financial calculation worksheets", "Whiteboard and markers"]
  },

  "research_methods": {
    canonicalKey: "research_methods",
    syllabusCode: "32.2.0",
    unitCode: "32.2.0",
    unitName: "Research Methods",
    moduleNumber: 2,
    nominalHours: 44,
    theoryHours: 26,
    practicalHours: 18,
    aliases: ["32.2.0", "Research Methods", "DND 2306", "DHN 2307", "DNDT 1107"],
    isAvailable: true,
    unitDescription: "This module unit equips the trainee with knowledge and skills to conduct, interpret, and communicate nutritional research.",
    overallCompetency: "Identify research problems; design appropriate research methodologies; develop data collection instruments; collect, analyse, and interpret data; write a scientific research report.",
    learningOutcomes: [
      "Explain the concept and types of research",
      "Identify and formulate a research problem",
      "Design a research methodology",
      "Develop and validate research instruments",
      "Collect, process, and analyse research data",
      "Write and present a scientific research report"
    ],
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "32.2.01 Introduction to Research Methods",
        subTopics: ["Meaning of research and related terms", "Importance of research in nutrition and dietetics", "Types of research: basic, applied, action, experimental, descriptive", "Research process: overview from problem identification to dissemination", "Sources of research problems in nutrition", "Ethical principles in nutritional research"],
        hours: 3,
        specificLearningOutcomes: "Define research; explain importance; describe types; outline research process.",
        learningActivities: "Lecture, group discussion on nutrition research problems.",
        resourcesAndReferences: "Research methods textbooks; journal articles.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "Problem Formulation and Literature Review",
        subTopics: ["Identifying a researchable problem: gap in knowledge, practical importance", "Background to the study", "Problem statement: gap, consequences, urgency", "Research objectives: general and specific, SMART", "Research questions and hypotheses", "Literature review: searching academic databases, synthesizing evidence"],
        hours: 3,
        specificLearningOutcomes: "Identify and formulate nutrition research problem; write problem statement and SMART objectives; conduct literature review.",
        learningActivities: "Lecture, problem formulation workshop, literature search practical.",
        resourcesAndReferences: "Academic databases (Google Scholar, PubMed); textbooks.",
        assessmentAndRemarks: "Problem statement and literature search exercise."
      },
      {
        weekNumber: 3,
        topicTitle: "Research Design and Study Population",
        subTopics: ["Types of research designs: cross-sectional, cohort, case-control, experimental, action research", "Criteria for selecting a research design", "Study population: target, accessible, inclusion and exclusion criteria", "Sample size determination", "Sampling techniques: probability and non-probability"],
        hours: 3,
        specificLearningOutcomes: "Select and justify appropriate research design; define study population; calculate sample sizes; select sampling techniques.",
        learningActivities: "Lecture, sample size calculation exercise.",
        resourcesAndReferences: "Research methodology textbooks; sampling formulae.",
        assessmentAndRemarks: "Sample size calculation exercise."
      },
      {
        weekNumber: 4,
        topicTitle: "Research Instruments Design and Validation",
        subTopics: ["Types of instruments: questionnaires, interviews, observation checklists, dietary assessment tools (24HR, FFQ, dietary diversity scores)", "Principles of questionnaire design: clarity, relevance, sequencing, scaling", "Likert scales and rating scales", "Validity: content, construct, face, criterion", "Reliability: test-retest, inter-rater, Cronbach's alpha", "Piloting instruments"],
        hours: 3,
        specificLearningOutcomes: "Design valid and reliable research instruments; apply appropriate scales; pre-test instruments.",
        learningActivities: "Lecture, questionnaire design practical, piloting exercise.",
        resourcesAndReferences: "Sample questionnaires; dietary assessment tools.",
        assessmentAndRemarks: "Questionnaire design submission."
      },
      {
        weekNumber: 5,
        topicTitle: "Data Collection Methods",
        subTopics: ["Primary data collection: interviews, self-administered questionnaires, observation, focus groups", "Secondary data sources: records review, national surveys", "Dietary data collection: 24-hour recall, FFQ, dietary diversity", "Anthropometric data collection: weight, height, MUAC, BMI", "Field management: supervision, quality assurance"],
        hours: 3,
        specificLearningOutcomes: "Select data collection methods; administer dietary recall; collect anthropometric measurements; manage field data collection.",
        learningActivities: "Lecture, dietary recall practical, anthropometric exercise.",
        resourcesAndReferences: "Dietary assessment tools; anthropometric equipment.",
        assessmentAndRemarks: "Dietary recall exercise, anthropometric practical."
      },
      {
        weekNumber: 6,
        topicTitle: "Data Management: Entry, Cleaning, and Processing",
        subTopics: ["Data management plan: organization, coding, data entry", "Developing a codebook: variable naming, labels, values", "Data entry using SPSS, Excel, or EpiData", "Data cleaning: errors, missing data, outlier detection", "Data transformation: recoding, computing composite variables"],
        hours: 3,
        specificLearningOutcomes: "Develop data management plan; enter and clean data; handle missing values and outliers.",
        learningActivities: "Computer laboratory data entry and cleaning exercises.",
        resourcesAndReferences: "SPSS/Excel; sample data sets.",
        assessmentAndRemarks: "Data entry and cleaning exercise."
      },
      {
        weekNumber: 7,
        topicTitle: "Data Analysis and Interpretation",
        subTopics: ["Descriptive analysis: frequencies, proportions, central tendency, dispersion", "Inferential analysis: chi-square, t-tests, ANOVA, correlation", "Qualitative data analysis: thematic analysis, content analysis", "Presenting results: tables, figures, and narrative text", "Interpretation in relation to objectives and existing literature"],
        hours: 3,
        specificLearningOutcomes: "Perform descriptive and inferential analysis; apply qualitative analysis; present and interpret findings.",
        learningActivities: "Computer laboratory analysis exercise, result presentation workshop.",
        resourcesAndReferences: "SPSS/Excel; data sets; statistical tables.",
        assessmentAndRemarks: "Data analysis report."
      },
      {
        weekNumber: 8,
        topicTitle: "Continuous Assessment Test (CAT) — Research Methods",
        subTopics: ["Written theory assessment covering topics from Weeks 1–7", "Post-CAT review and feedback session"],
        hours: 3,
        specificLearningOutcomes: "Demonstrate mastery of research methods concepts from Weeks 1–7.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 9,
        topicTitle: "Scientific Report Writing — Introduction and Literature Review",
        subTopics: ["Structure of a scientific research report: chapters and sections", "Writing Chapter 1: Introduction — background, problem, objectives, significance", "Writing Chapter 2: Literature review — critical synthesis, conceptual framework", "Academic writing style: clarity, citation (APA 7th edition)", "Plagiarism: detection and prevention"],
        hours: 3,
        specificLearningOutcomes: "Describe structure of a scientific report; write Chapter 1 and Chapter 2; apply APA 7th edition citation.",
        learningActivities: "Guided report writing workshop.",
        resourcesAndReferences: "APA 7th edition guide; sample research reports.",
        assessmentAndRemarks: "Chapter 1 and 2 draft submission."
      },
      {
        weekNumber: 10,
        topicTitle: "Scientific Report Writing — Methodology and Results",
        subTopics: ["Writing Chapter 3: Methodology — design, study area, population, sampling, instruments, analysis, ethics", "Writing Chapter 4: Results and Findings — tables, figures, narrative text", "Writing the abstract: structured and unstructured formats"],
        hours: 3,
        specificLearningOutcomes: "Write Chapter 3 and Chapter 4 accurately; present results using tables and figures; write a scientific abstract.",
        learningActivities: "Guided report writing workshop.",
        resourcesAndReferences: "Sample research reports; data presentation templates.",
        assessmentAndRemarks: "Chapter 3 and 4 draft submission."
      },
      {
        weekNumber: 11,
        topicTitle: "Scientific Report Writing — Discussion, Conclusions, and Recommendations",
        subTopics: ["Writing Chapter 5: Discussion — comparing results with literature", "Drawing conclusions that answer study objectives", "Formulating evidence-based recommendations", "Study limitations and future research directions", "Compiling references in APA 7th edition", "Preparing appendices: questionnaires, consent forms"],
        hours: 3,
        specificLearningOutcomes: "Write Chapter 5; compile APA reference list; prepare appendices.",
        learningActivities: "Guided report writing workshop.",
        resourcesAndReferences: "APA reference guide; sample research reports.",
        assessmentAndRemarks: "Chapter 5 and references submission."
      },
      {
        weekNumber: 12,
        topicTitle: "Research Ethics and Integrity",
        subTopics: ["Research ethics principles: respect for persons, beneficence, non-maleficence, justice", "Informed consent: process, elements, documentation", "Confidentiality and data anonymization", "Research with vulnerable populations: children, HIV-positive, pregnant women", "Scientific misconduct: fabrication, falsification, plagiarism (FFP)", "Kenya ethical review: NACOSTI, IRB"],
        hours: 3,
        specificLearningOutcomes: "Describe ethics principles; develop informed consent process; explain Kenya ethical review process.",
        learningActivities: "Lecture, consent form drafting, case studies.",
        resourcesAndReferences: "NACOSTI ethical guidelines; Belmont Report.",
        assessmentAndRemarks: "Consent form draft, oral questions."
      },
      {
        weekNumber: 13,
        topicTitle: "Research Communication and Dissemination",
        subTopics: ["Oral research presentation: structure, visual aids, effective communication", "Writing a scientific journal article: IMRAD format", "Research poster design and presentation", "Policy briefs from research findings", "Knowledge translation: bridging research and practice"],
        hours: 3,
        specificLearningOutcomes: "Present research findings orally and through a poster; describe journal article structure; write a basic policy brief.",
        learningActivities: "Oral presentation rehearsals, poster design exercise.",
        resourcesAndReferences: "Journal article samples; poster templates; projector.",
        assessmentAndRemarks: "Oral presentation, poster submission."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Research Methods",
        subTopics: ["Comprehensive written theory examination covering all prescribed unit topics", "Practical: research proposal or report critique exercise"],
        hours: 3,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of research methods principles.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Mugenda, O. M., & Mugenda, A. G. (2019). Research Methods: Quantitative and Qualitative Approaches. ACTS Press.",
      "Kothari, C. R., & Garg, G. (2019). Research Methodology: Methods and Techniques (4th ed.). New Age International Publishers."
    ],
    instructionalEquipment: ["Computers with SPSS and Excel", "Projector and laptop", "Dietary assessment tools", "Anthropometric equipment"]
  },

  "industrial_attachment_ii": {
    canonicalKey: "industrial_attachment_ii",
    syllabusCode: "33.2.0",
    unitCode: "33.2.0",
    unitName: "Industrial Attachment II",
    moduleNumber: 2,
    nominalHours: 330,
    theoryHours: 0,
    practicalHours: 330,
    aliases: ["33.2.0", "Industrial Attachment II", "DND 3301"],
    isAvailable: true,
    unitDescription: "This module unit enables the trainee to acquire vocational competence through supervised attachment in a relevant industry, hospital, public health facility, or food production enterprise for 8 weeks.",
    overallCompetency: "Apply theoretical knowledge in real-world nutrition, dietetics, food service, and public health environments; demonstrate professional conduct; compile a comprehensive field attachment logbook and report.",
    learningOutcomes: [
      "Apply nutrition and dietetics knowledge in a supervised work environment",
      "Demonstrate professional conduct, communication, and teamwork",
      "Observe and participate in clinical nutrition, dietary counselling, food service, or community nutrition",
      "Maintain an accurate daily attachment logbook",
      "Compile and present a comprehensive industrial attachment report"
    ],
    teachingLearningApproaches: "Supervised practical placement at approved facilities. Weekly logbook entries. Supervisor mentorship. End-of-placement report and institutional presentation.",
    assessmentApproaches: "100% practical-based: Supervisor Appraisal (40%), Logbook Quality (30%), Attachment Report (20%), Institutional Presentation (10%). No written theory examination.",
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Attachment Orientation and Workplace Induction",
        subTopics: ["Institutional welcome, orientation, and health and safety induction", "Meeting supervisor and departmental staff", "Understanding facility layout, departments, protocols, and dress code", "Scope of nutrition and dietetics work at the institution", "Beginning Daily Logbook: Week 1 entries"],
        hours: 24,
        specificLearningOutcomes: "Navigate the facility; describe organizational structure; begin systematic daily logbook entries.",
        learningActivities: "Orientation, departmental visits, shadowing senior staff, logbook entry.",
        resourcesAndReferences: "Institutional induction manual; logbook.",
        assessmentAndRemarks: "Logbook entry review (Week 1)."
      },
      {
        weekNumber: 2,
        topicTitle: "Clinical Nutrition — Inpatient Ward Assessment",
        subTopics: ["Nutritional screening of hospital inpatients", "Applying MNA, MUST, or SNAQ screening tools", "Reviewing patient case files and medical records", "Therapeutic diet prescription and ward diet rounds", "Nutrition Support Team (NST) activities"],
        hours: 24,
        specificLearningOutcomes: "Apply nutritional screening tools in clinical setting; describe therapeutic diet prescription; record observations in logbook.",
        learningActivities: "Ward rounds, nutritional screening, case file review, logbook entry.",
        resourcesAndReferences: "Patient records; screening tools; clinical nutrition manuals.",
        assessmentAndRemarks: "Logbook entry review (Week 2)."
      },
      {
        weekNumber: 3,
        topicTitle: "Dietary Assessment and Counselling Practice",
        subTopics: ["24-hour dietary recalls with patients or community clients", "Food frequency questionnaire administration", "One-on-one dietary counselling sessions under supervision", "Group nutrition education in outpatient or MCH clinic settings", "Documenting counselling sessions"],
        hours: 24,
        specificLearningOutcomes: "Conduct dietary assessments; facilitate nutrition counselling; document dietary counselling appropriately.",
        learningActivities: "Dietary recall, counselling sessions, group education, logbook entry.",
        resourcesAndReferences: "Dietary assessment tools; counselling guides; logbook.",
        assessmentAndRemarks: "Logbook entry, supervisor mid-point feedback."
      },
      {
        weekNumber: 4,
        topicTitle: "Food Service and Kitchen Management Attachment",
        subTopics: ["Institutional food service operations: hospital kitchen, school canteen, catering unit", "HACCP principles in institutional food production", "Menu planning and therapeutic diet preparation", "Portion control, meal delivery, patient tray assessment", "Dietary services administrative documentation"],
        hours: 24,
        specificLearningOutcomes: "Describe food service management operations; apply HACCP; participate in therapeutic diet preparation and delivery.",
        learningActivities: "Kitchen placement, food service observation, menu review, logbook.",
        resourcesAndReferences: "HACCP guidelines; institutional kitchen procedures.",
        assessmentAndRemarks: "Logbook entry review (Week 4)."
      },
      {
        weekNumber: 5,
        topicTitle: "Community and Public Health Nutrition Activities",
        subTopics: ["Community outreach and nutrition assessment activities", "Growth monitoring at MCH clinics: weighing, MUAC, growth chart plotting", "Vitamin A supplementation campaigns and deworming", "Community cooking demonstrations and nutrition education", "Home visits for malnourished children"],
        hours: 24,
        specificLearningOutcomes: "Conduct growth monitoring; participate in community nutrition outreach; facilitate cooking demonstrations.",
        learningActivities: "MCH clinic attachment, community outreach, home visits, logbook.",
        resourcesAndReferences: "Growth charts; MUAC tapes; community education materials.",
        assessmentAndRemarks: "Logbook entry, supervisor appraisal (midpoint)."
      },
      {
        weekNumber: 6,
        topicTitle: "Specialized Nutrition Services — HIV, TB, and Chronic Conditions",
        subTopics: ["Nutrition assessment and counselling for HIV-positive clients at ART clinic", "Nutritional management of TB patients on treatment", "Diet counselling for clients with diabetes, hypertension, or CKD", "Documenting nutrition care plans", "Referral to nutrition support services"],
        hours: 24,
        specificLearningOutcomes: "Provide nutrition counselling for HIV, TB, and chronic disease clients; document nutrition care plans; apply referral pathways.",
        learningActivities: "ART clinic attachment, chronic disease clinic, counselling sessions, logbook.",
        resourcesAndReferences: "HIV/TB nutrition guidelines; clinical nutrition manuals.",
        assessmentAndRemarks: "Logbook entry review (Week 6)."
      },
      {
        weekNumber: 7,
        topicTitle: "Fieldwork Research Activity and Report Preparation",
        subTopics: ["Mini needs assessment or nutrition survey at attachment site", "Analysing and interpreting collected data", "Drafting sections of the industrial attachment report", "Photography and documentation of attachment activities"],
        hours: 24,
        specificLearningOutcomes: "Conduct simple nutrition needs assessment; draft attachment report sections; document key observations.",
        learningActivities: "Needs assessment, data analysis, report writing, supervisor consultation.",
        resourcesAndReferences: "Logbook; needs assessment tools; report writing guidelines.",
        assessmentAndRemarks: "Report draft submission to supervisor."
      },
      {
        weekNumber: 8,
        topicTitle: "Attachment Conclusion, Logbook Completion, and Report Submission",
        subTopics: ["Finalization of all logbook entries and supervisor sign-off", "Complete Industrial Attachment Report compilation", "Formal exit meeting with institutional supervisor", "Preparation for institutional presentation", "Final submission of Logbook and Attachment Report"],
        hours: 24,
        specificLearningOutcomes: "Complete and submit logbook with supervisor endorsement; submit comprehensive attachment report; present key learning outcomes.",
        learningActivities: "Report finalization, exit meeting, institutional presentation, submission.",
        resourcesAndReferences: "Logbook; report writing guidelines; presentation slides.",
        assessmentAndRemarks: "Final logbook and report submission. Supervisor appraisal form. Institutional presentation."
      },
      {
        weekNumber: 9,
        topicTitle: "Institutional Presentation of Attachment Experiences",
        subTopics: ["Formal presentation of attachment findings to faculty, peers, and supervisors", "Key observations, lessons learned, and recommendations", "Q&A session with panel", "Peer learning from diverse placement experiences"],
        hours: 24,
        specificLearningOutcomes: "Deliver confident oral presentation of attachment findings; respond to panel questions; reflect on learning.",
        learningActivities: "Formal presentation, panel Q&A, peer feedback.",
        resourcesAndReferences: "Presentation slides; evaluation rubric.",
        assessmentAndRemarks: "Institutional presentation assessment."
      },
      {
        weekNumber: 10,
        topicTitle: "Post-Attachment Reflection and Learning Consolidation",
        subTopics: ["Personal reflection on professional growth during attachment", "Identifying skills gaps and areas for further development", "Comparing theoretical knowledge with practical experience", "Writing personal development plan"],
        hours: 24,
        specificLearningOutcomes: "Reflect critically on competence gained; identify development areas; write structured personal development plan.",
        learningActivities: "Group reflective discussion, personal development plan writing.",
        resourcesAndReferences: "Reflective practice guides; personal development plan templates.",
        assessmentAndRemarks: "Personal development plan submission."
      },
      {
        weekNumber: 11,
        topicTitle: "Applied Skills Consolidation — Anthropometry",
        subTopics: ["Consolidation of anthropometric measurement skills from attachment", "Standardization of weighing, height, MUAC, skinfold techniques", "Growth chart interpretation and plotting review", "WHO z-score classification in practical settings"],
        hours: 24,
        specificLearningOutcomes: "Demonstrate proficiency in anthropometric measurement; interpret growth charts and z-scores accurately.",
        learningActivities: "Practical measurement exercises, case study analysis.",
        resourcesAndReferences: "Anthropometric equipment; growth charts; WHO z-score tables.",
        assessmentAndRemarks: "Practical competency check."
      },
      {
        weekNumber: 12,
        topicTitle: "Applied Skills Consolidation — Dietary Assessment",
        subTopics: ["Consolidation of dietary assessment skills from attachment", "24-hour dietary recall practice with peers", "FFQ administration review", "Dietary diversity score calculation", "Nutrient analysis using food composition tables"],
        hours: 24,
        specificLearningOutcomes: "Administer dietary recall and FFQ proficiently; calculate dietary diversity scores; analyse dietary data.",
        learningActivities: "Dietary recall practical, FFQ exercise, nutrient analysis.",
        resourcesAndReferences: "Dietary assessment tools; food composition tables.",
        assessmentAndRemarks: "Dietary assessment practical check."
      },
      {
        weekNumber: 13,
        topicTitle: "Applied Skills Consolidation — Nutrition Counselling and Education",
        subTopics: ["Structured counselling practice: case scenarios from attachment", "Group nutrition education session facilitation", "Culturally appropriate education session planning", "Peer evaluation of counselling and education skills"],
        hours: 24,
        specificLearningOutcomes: "Conduct structured counselling sessions; facilitate group education; apply attachment learning in counselling contexts.",
        learningActivities: "Counselling role play, group education facilitation, peer evaluation.",
        resourcesAndReferences: "Counselling guides; education materials; evaluation forms.",
        assessmentAndRemarks: "Practical counselling assessment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Practical Assessment — Industrial Attachment II",
        subTopics: ["Practical assessment across key practice areas", "Stations: anthropometric assessment, dietary recall, therapeutic diet planning, nutrition counselling", "Logbook final verification and sign-off confirmation"],
        hours: 24,
        specificLearningOutcomes: "Demonstrate comprehensive practical competence across nutrition and dietetics practice areas.",
        learningActivities: "Supervised practical OSCE-style assessment.",
        resourcesAndReferences: "Assessment station materials; marking rubrics.",
        assessmentAndRemarks: "Final practical summative assessment."
      }
    ],
    references: [
      "Ministry of Health, Kenya. (2019). Clinical Nutrition Guidelines. Government of Kenya.",
      "WHO. (2021). Nutritional Guidelines for Clinical Practice. World Health Organization."
    ],
    instructionalEquipment: ["Logbook portfolios", "Anthropometric equipment", "Dietary assessment tools", "Clinical nutrition reference guides", "Presentation projector and laptop"]
  }
};
