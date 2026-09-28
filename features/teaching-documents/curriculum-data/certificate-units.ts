// Authoritative TVET Curriculum Registry — CHN Certificate in Nutrition Unique Units
// Source: Department course outlines, schemes of work, and KNEC certificate nutrition curriculum
// These units are specific to the Certificate in Nutrition (CHN) and closely related CND/DND programmes.
import type { CanonicalCurriculumUnit } from './types';

export const CERTIFICATE_CURRICULUM: Record<string, CanonicalCurriculumUnit> = {

  "demonstration_techniques": {
    canonicalKey: "demonstration_techniques",
    syllabusCode: "CHN 2306",
    unitCode: "CHN 2306",
    unitName: "Demonstration Techniques",
    moduleNumber: 2,
    nominalHours: 40,
    theoryHours: 24,
    practicalHours: 16,
    aliases: ["CHN 2306", "CND 2304", "Demonstration Techniques", "Demonstration Technique"],
    isAvailable: true,
    unitDescription: "This unit equips the trainee with knowledge and skills to plan, organize, and conduct effective nutrition demonstrations in community and clinical settings.",
    overallCompetency: "By the end of the unit, the trainee should be able to: define demonstration techniques; identify equipment for nutritional demonstrations; demonstrate diet modification; demonstrate anthropometric and dietary assessment tools; demonstrate food security and infant feeding practices; demonstrate food processing and preservation techniques.",
    learningOutcomes: [
      "Define and explain demonstration techniques and their importance in nutrition education",
      "Calibrate and use equipment for nutritional demonstrations",
      "Demonstrate normal and modified therapeutic diets",
      "Use anthropometric and dietary assessment tools in demonstrations",
      "Demonstrate food security interventions: kitchen gardening and sack gardening",
      "Demonstrate breastfeeding, replacement feeding, and complementary feeding",
      "Demonstrate food processing and preservation methods",
      "Demonstrate packaging of food products"
    ],
    teachingLearningApproaches: "Demonstrations, practical sessions, group discussions, lecture presentations, field visits.",
    assessmentApproaches: "Continuous Assessment Test (CAT); written summative examination; practical skill demonstration assessments.",
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Introduction to Demonstration Techniques",
        subTopics: [
          "Definition of demonstration techniques",
          "Types of demonstrations: result, method, and product demonstrations",
          "Importance of demonstration techniques in nutrition education",
          "Equipment calibration: weighing scales, height boards, MUAC tapes",
          "Principles of effective nutrition demonstrations"
        ],
        hours: 3,
        specificLearningOutcomes: "Define demonstration techniques; identify types; explain importance; calibrate equipment.",
        learningActivities: "Lecture presentation, equipment calibration practical, group discussion.",
        resourcesAndReferences: "Anthropometric equipment; nutrition demonstration manuals; textbooks.",
        assessmentAndRemarks: "Class quiz, equipment calibration practical check."
      },
      {
        weekNumber: 2,
        topicTitle: "Diet Modification Demonstration Techniques",
        subTopics: [
          "Normal diet: components and food groups",
          "Ways of modifying the normal diet: texture modification, energy modification, nutrient restriction",
          "Therapeutic diets: soft diet, liquid diet, high-fibre diet, low-sodium diet",
          "Demonstrating preparation of therapeutic diet modifications"
        ],
        hours: 3,
        specificLearningOutcomes: "Describe normal diet components; demonstrate methods of dietary modification; prepare therapeutic diet modifications.",
        learningActivities: "Lecture, food preparation demonstration.",
        resourcesAndReferences: "Food samples; cooking equipment; diet modification guides.",
        assessmentAndRemarks: "Practical demonstration, oral questions."
      },
      {
        weekNumber: 3,
        topicTitle: "Equipment and Tools in Nutrition Assessment Demonstrations",
        subTopics: [
          "Anthropometric tools: weighing scales, height boards, MUAC tape, skinfold calipers",
          "Anthropometric demonstration: measuring weight, height, MUAC of adults and children",
          "Dietary assessment tools: 24-hour dietary recall guides, food models, food frequency questionnaires",
          "Demonstrating dietary assessment: administering a 24-hour recall",
          "Interpreting and recording nutritional assessment results"
        ],
        hours: 3,
        specificLearningOutcomes: "Identify and use anthropometric and dietary assessment tools; demonstrate nutritional assessment techniques.",
        learningActivities: "Practical anthropometric measurement and dietary recall demonstrations.",
        resourcesAndReferences: "Anthropometric equipment; dietary recall guides; food models.",
        assessmentAndRemarks: "Practical competency check."
      },
      {
        weekNumber: 4,
        topicTitle: "Food Security Demonstration: Kitchen and Sack Gardening",
        subTopics: [
          "Concept of household food security and its nutritional significance",
          "Kitchen gardening: selection of vegetables, preparation of garden, planting techniques",
          "Sack gardening: materials, soil preparation, planting, watering",
          "Advantages of kitchen and sack gardening for household nutrition",
          "Care and maintenance of kitchen/sack gardens"
        ],
        hours: 3,
        specificLearningOutcomes: "Explain food security; demonstrate kitchen gardening and sack gardening techniques.",
        learningActivities: "Practical kitchen and sack gardening establishment.",
        resourcesAndReferences: "Gardening materials; seeds; sacks; soil.",
        assessmentAndRemarks: "Practical garden setup assessment."
      },
      {
        weekNumber: 5,
        topicTitle: "Infant Feeding Demonstration — Part I: Breastfeeding and Replacement Feeding",
        subTopics: [
          "Exclusive breastfeeding: positioning, attachment, and latch technique",
          "Breastfeeding counselling points: common problems and solutions",
          "Replacement feeding: indications, types of formula, safe preparation",
          "Demonstrating breastfeeding technique using a manikin",
          "Demonstrating safe preparation of infant formula"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate breastfeeding technique; counsel on positioning and latch; demonstrate formula preparation.",
        learningActivities: "Practical breastfeeding demonstration using manikin, formula preparation exercise.",
        resourcesAndReferences: "Breastfeeding manikin; infant formula; feeding bottles; demonstration manual.",
        assessmentAndRemarks: "Practical demonstration assessment."
      },
      {
        weekNumber: 6,
        topicTitle: "Infant Feeding Demonstration — Part II: Bottle Feeding and Complementary Feeding",
        subTopics: [
          "Bottle feeding: preparation, sterilization of feeding equipment, safe technique",
          "Complementary feeding: timing, frequency, quality, and quantity (WHO guidelines)",
          "Preparation of appropriate complementary foods for infants 6–12 months",
          "Demonstrating responsive feeding practices",
          "Complementary food preparation for older infants (12–24 months)"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate bottle feeding; prepare and demonstrate age-appropriate complementary foods.",
        learningActivities: "Practical food preparation demonstration, bottle feeding and sterilization practical.",
        resourcesAndReferences: "Feeding bottles; local food ingredients; demonstration manual.",
        assessmentAndRemarks: "Practical food preparation and feeding demonstration."
      },
      {
        weekNumber: 7,
        topicTitle: "Continuous Assessment Test (CAT) — Demonstration Techniques",
        subTopics: [
          "Written theory assessment covering topics from Weeks 1–6",
          "Practical skill demonstration assessment",
          "Post-CAT review and feedback session"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate mastery of demonstration techniques concepts and skills from Weeks 1–6.",
        learningActivities: "Supervised written CAT and practical demonstration assessment.",
        resourcesAndReferences: "Examination scripts; marking keys; demonstration equipment.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT) — written and practical."
      },
      {
        weekNumber: 8,
        topicTitle: "Food Processing and Preservation Demonstration — Part I: Thermal and Low Temperature",
        subTopics: [
          "Blanching: demonstration of blanching vegetables before preservation",
          "Pasteurization: demonstrating pasteurization of milk using HTST method",
          "Fermentation: demonstration of fermentation — yoghurt, uji, fermented vegetables",
          "Refrigeration and cold storage: demonstration of correct use and food safety",
          "Practical: blanching, pasteurization, and fermentation"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate blanching, pasteurization, fermentation, and cold storage food preservation techniques.",
        learningActivities: "Practical food preservation demonstrations.",
        resourcesAndReferences: "Food preservation equipment; food samples; textbooks.",
        assessmentAndRemarks: "Practical observation, product quality check."
      },
      {
        weekNumber: 9,
        topicTitle: "Food Processing and Preservation Demonstration — Part II: Drying, Salting, Smoking, Pickling",
        subTopics: [
          "Drying: sun drying vegetables, fruits, and cereals",
          "Salting: dry salting and brine curing of fish and vegetables",
          "Smoking: hot smoking of fish",
          "Pickling: production of vinegar pickles for vegetables",
          "Practical: drying, salting, smoking, and pickling demonstrations"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate drying, salting, smoking, and pickling food preservation techniques.",
        learningActivities: "Practical food preservation demonstrations.",
        resourcesAndReferences: "Drying trays; salt; smoking equipment; pickling jars; food samples.",
        assessmentAndRemarks: "Practical observation, product quality check."
      },
      {
        weekNumber: 10,
        topicTitle: "Food Packaging Demonstration",
        subTopics: [
          "Types of packaging materials: glass jars, plastic containers, paper wrappings, tin cans, polythene",
          "Properties required of packaging materials for different foods",
          "Demonstrating appropriate packaging of dried foods, pickled products, and fresh produce",
          "Packaging labelling: content, date of manufacture, expiry date",
          "Practical: packaging demonstration for different food products"
        ],
        hours: 3,
        specificLearningOutcomes: "Identify appropriate packaging materials; demonstrate packaging of different food products; apply labelling standards.",
        learningActivities: "Practical food packaging demonstration.",
        resourcesAndReferences: "Packaging materials; labelling supplies; food samples.",
        assessmentAndRemarks: "Practical packaging exercise, assessment."
      },
      {
        weekNumber: 11,
        topicTitle: "Community-Level Nutrition Demonstration Events",
        subTopics: [
          "Planning a community nutrition demonstration event",
          "Selecting target audience and demonstration topic",
          "Preparing materials, food samples, and visual aids",
          "Conducting a group demonstration at community level",
          "Evaluating effectiveness of a nutrition demonstration"
        ],
        hours: 3,
        specificLearningOutcomes: "Plan and conduct a community nutrition demonstration event; evaluate demonstration effectiveness.",
        learningActivities: "Planning exercise, simulated community demonstration, peer feedback.",
        resourcesAndReferences: "Community demonstration planning guides; visual aids; food samples.",
        assessmentAndRemarks: "Community demonstration practical assessment."
      },
      {
        weekNumber: 12,
        topicTitle: "Emerging Issues and Trends in Demonstration Techniques",
        subTopics: [
          "Emerging issues: use of digital platforms and video demonstrations in nutrition education",
          "Social media demonstration techniques for nutrition behaviour change",
          "Challenges posed by emerging trends: technology access, digital literacy",
          "Coping strategies: hybrid demonstration approaches"
        ],
        hours: 3,
        specificLearningOutcomes: "Discuss emerging issues; describe digital demonstration approaches; identify coping strategies.",
        learningActivities: "Group discussions, presentations.",
        resourcesAndReferences: "Internet resources; social media platforms; journal articles.",
        assessmentAndRemarks: "Oral presentation, assignment."
      },
      {
        weekNumber: 13,
        topicTitle: "Demonstration Presentations — Student Led",
        subTopics: [
          "Individual student-led nutrition demonstrations on assigned topics",
          "Peer evaluation and feedback on demonstration techniques",
          "Reflection and improvement of presentation skills"
        ],
        hours: 3,
        specificLearningOutcomes: "Conduct an independent nutrition demonstration; respond to peer feedback; reflect on demonstration quality.",
        learningActivities: "Student-led demonstrations, peer evaluation.",
        resourcesAndReferences: "Demonstration evaluation rubric; topic materials.",
        assessmentAndRemarks: "Individual demonstration assessment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Demonstration Techniques",
        subTopics: [
          "Comprehensive written theory examination covering all prescribed unit topics",
          "Practical examination: a full nutrition demonstration on an assigned topic"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of demonstration techniques theory and practical skills.",
        learningActivities: "Supervised theory and practical summative examination.",
        resourcesAndReferences: "Official examination papers; demonstration equipment; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "FAO/WHO. (2014). Nutrition Education and Consumer Awareness. Food and Agriculture Organization.",
      "WHO. (2022). Infant and Young Child Feeding Counselling: An Integrated Course. WHO.",
      "Ministry of Health, Kenya. (2018). Community-Based Nutrition Interventions Manual. Government of Kenya."
    ],
    instructionalEquipment: [
      "Anthropometric equipment (weighing scales, height boards, MUAC tapes)",
      "Food models and visual aids",
      "Cooking utensils and food samples",
      "Breastfeeding manikin",
      "Infant formula and feeding bottles",
      "Food preservation equipment",
      "Packaging materials",
      "Whiteboard and LCD projector"
    ]
  },

  "nutrition_for_vulnerable_groups": {
    canonicalKey: "nutrition_for_vulnerable_groups",
    syllabusCode: "CHN 2308",
    unitCode: "CHN 2308",
    unitName: "Nutrition for Vulnerable Groups",
    moduleNumber: 2,
    nominalHours: 40,
    theoryHours: 24,
    practicalHours: 16,
    aliases: [
      "CHN 2308", "CND 2305", "Nutrition for Vulnerable Groups", "Vulnerable Groups Nutrition",
      "Nutrition and Vulnerable Groups", "CHN 1202"
    ],
    isAvailable: true,
    unitDescription: "This unit equips the trainee with knowledge and skills to assess and address the nutritional needs of nutritionally vulnerable groups in Kenya.",
    overallCompetency: "By the end of the unit, the trainee should be able to: define nutritionally vulnerable groups; describe nutrient requirements and interventions for each vulnerable group; plan appropriate nutritional interventions for displaced persons, elderly, disabled, prisoners, and people in ASALs and resource-poor settings.",
    learningOutcomes: [
      "Define meaning of terms and identify nutritionally vulnerable groups",
      "Describe nutrition for low birth weight and very low birth weight children",
      "Describe nutrient requirements and interventions for pregnant and lactating women",
      "Explain nutrition for individuals with chronic conditions",
      "Describe nutrition for displaced persons and refugees",
      "Explain nutrition for the elderly",
      "Describe nutrition for people in ASAL areas",
      "Describe nutrition for people in resource-poor settings and slums",
      "Describe nutrition for persons with disability",
      "Describe nutrition for prisoners"
    ],
    teachingLearningApproaches: "Lectures, group discussions, field visits, case studies, demonstrations, presentations.",
    assessmentApproaches: "Continuous Assessment Test (CAT); written summative examination.",
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Introduction to Nutrition for Vulnerable Groups",
        subTopics: [
          "Meaning of terms: vulnerability, nutritional vulnerability, food insecurity, malnutrition",
          "Importance of addressing nutritional needs of vulnerable groups",
          "Identification and classification of nutritionally vulnerable groups in Kenya",
          "Determinants of nutritional vulnerability: social, economic, biological, environmental",
          "Framework for nutritional interventions for vulnerable groups"
        ],
        hours: 3,
        specificLearningOutcomes: "Define terms; explain importance; identify and classify nutritionally vulnerable groups; describe determinants.",
        learningActivities: "Lecture, group discussions, case presentations.",
        resourcesAndReferences: "Textbooks; WHO vulnerability guidelines; charts.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "Nutrition for Low Birth Weight and VLBW Children",
        subTopics: [
          "Definition of low birth weight (LBW) and very low birth weight (VLBW)",
          "Factors contributing to LBW: maternal nutrition, infections, preterm birth",
          "Nutritional requirements of LBW and VLBW infants: energy, protein, calcium, iron, vitamins",
          "Feeding options: breast milk, donor breast milk, fortified formula",
          "Kangaroo Mother Care (KMC) and its nutritional significance"
        ],
        hours: 3,
        specificLearningOutcomes: "Define LBW/VLBW; identify contributing factors; describe nutrient requirements; explain feeding options including KMC.",
        learningActivities: "Lecture, case discussions.",
        resourcesAndReferences: "WHO LBW guidelines; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 3,
        topicTitle: "Nutrition for Pregnant and Lactating Women and Children Under Five",
        subTopics: [
          "Factors affecting nutrition in pregnancy: physiological changes, cultural factors, food access",
          "Nutrient requirements during pregnancy: iron, folate, calcium, vitamin A, zinc",
          "Interventions: iron-folate supplementation, dietary diversification, ANC nutrition",
          "Nutrient requirements during lactation",
          "Children under five: growth faltering, micronutrient deficiencies, IYCF",
          "Vitamin A supplementation, deworming, and CMAM programmes"
        ],
        hours: 3,
        specificLearningOutcomes: "Describe factors affecting nutrition in pregnancy; state nutrient requirements; describe interventions for pregnant/lactating women and under-five children.",
        learningActivities: "Lecture, case discussions, diet planning exercise.",
        resourcesAndReferences: "WHO antenatal nutrition guidelines; IYCF guidelines; textbooks.",
        assessmentAndRemarks: "Oral questions, diet plan."
      },
      {
        weekNumber: 4,
        topicTitle: "Nutrition for Individuals with Chronic Conditions",
        subTopics: [
          "Types of chronic conditions with nutritional implications: HIV/AIDS, tuberculosis, cancer, diabetes, chronic kidney disease",
          "Nutritional effects of chronic conditions: wasting, micronutrient deficiencies, malabsorption",
          "Nutrient requirements for individuals with each chronic condition",
          "Nutritional interventions: therapeutic diets, supplementation, fortification",
          "Nutrition counselling for individuals with chronic conditions"
        ],
        hours: 3,
        specificLearningOutcomes: "Identify types of chronic conditions; describe nutritional effects; state nutrient requirements; plan interventions.",
        learningActivities: "Lecture, case studies, diet planning exercise.",
        resourcesAndReferences: "WHO HIV nutrition guidelines; clinical nutrition textbooks.",
        assessmentAndRemarks: "Case study analysis, diet plan."
      },
      {
        weekNumber: 5,
        topicTitle: "Nutrition for Displaced Persons and Refugees",
        subTopics: [
          "Factors leading to displacement: conflict, drought, disasters",
          "Nutritional consequences of displacement: food insecurity, malnutrition, micronutrient deficiencies",
          "General food ration (GFR) and selective feeding programmes",
          "Nutritional interventions in emergency settings: Sphere standards",
          "Complementary feeding in emergency settings",
          "Psychosocial aspects of feeding displaced populations"
        ],
        hours: 3,
        specificLearningOutcomes: "Identify factors leading to displacement; describe nutritional consequences; describe emergency feeding programmes and Sphere standards.",
        learningActivities: "Lecture, case studies on refugee nutrition.",
        resourcesAndReferences: "UNHCR/WFP feeding guidelines; Sphere Project handbook; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 6,
        topicTitle: "Nutrition for the Elderly",
        subTopics: [
          "Factors affecting nutrition in the elderly: physiological changes, socioeconomic, psychosocial",
          "Physiological changes with aging affecting nutrition: taste, dentition, GI motility, sarcopenia",
          "Nutrient requirements for the elderly: energy, calcium, vitamin D, protein, B12, fluids",
          "Interventions: meal modification, supplementation, social feeding programmes",
          "Nutritional assessment of the elderly: MNA, MUST"
        ],
        hours: 3,
        specificLearningOutcomes: "Describe factors and physiological changes affecting elderly nutrition; state nutrient requirements; describe interventions.",
        learningActivities: "Lecture, case studies.",
        resourcesAndReferences: "WHO Healthy Ageing resources; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 7,
        topicTitle: "Continuous Assessment Test (CAT) — Nutrition for Vulnerable Groups",
        subTopics: [
          "Written theory assessment covering topics from Weeks 1–6",
          "Post-CAT review and feedback session"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate mastery of concepts from Weeks 1–6.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 8,
        topicTitle: "Nutrition for People in Arid and Semi-Arid Lands (ASAL)",
        subTopics: [
          "Characteristics of ASAL areas in Kenya: climate, food systems, livelihoods",
          "Nutritional challenges in ASAL: chronic food insecurity, drought-induced malnutrition",
          "Common nutritional problems: acute malnutrition (SAM/MAM), micronutrient deficiencies",
          "Interventions: CMAM, cash transfers, food vouchers, WASH, nutrition surveillance",
          "Pastoralist livelihood nutrition programming"
        ],
        hours: 3,
        specificLearningOutcomes: "Describe ASAL characteristics; identify nutritional challenges; describe interventions for ASAL populations.",
        learningActivities: "Lecture, case studies on ASAL nutrition programming.",
        resourcesAndReferences: "Kenya ASAL nutrition guidelines; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 9,
        topicTitle: "Nutrition for People in Resource-Poor Settings and Urban Slums",
        subTopics: [
          "Characteristics of resource-poor urban settings: slum characteristics, food environment",
          "Nutritional challenges: dietary poverty, food insecurity, double burden of malnutrition",
          "Common nutritional problems: micronutrient deficiencies, overweight, stunting",
          "Interventions: community gardens, social protection programmes, subsidized food programmes",
          "Street food safety and nutrition in urban settings"
        ],
        hours: 3,
        specificLearningOutcomes: "Describe resource-poor urban settings; identify nutritional challenges; describe interventions.",
        learningActivities: "Lecture, community case study discussions.",
        resourcesAndReferences: "UN-Habitat nutrition resources; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 10,
        topicTitle: "Nutrition for Persons with Disability",
        subTopics: [
          "Types of disabilities and their nutritional implications: physical, intellectual, sensory",
          "Factors affecting nutrition in persons with disability: mobility, feeding difficulties, dependency",
          "Nutritional requirements for different types of disability",
          "Adaptive feeding strategies: assistive feeding equipment, texture modification",
          "Nutritional assessment of persons with disability: special considerations"
        ],
        hours: 3,
        specificLearningOutcomes: "Identify types of disabilities; describe nutritional implications; apply adaptive feeding strategies.",
        learningActivities: "Lecture, case studies.",
        resourcesAndReferences: "Disability nutrition resources; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 11,
        topicTitle: "Nutrition for Prisoners",
        subTopics: [
          "Characteristics of prison population: demographics, health status, risk factors",
          "Nutritional challenges in prisons: limited food variety, overcrowding, communicable diseases",
          "Nutrient requirements and dietary standards for prisoners",
          "Interventions: standard prison diet improvement, micronutrient supplementation, HIV/TB nutrition in prisons",
          "Kenya Prisons Service nutrition standards"
        ],
        hours: 3,
        specificLearningOutcomes: "Describe prison population characteristics; identify nutritional challenges; describe interventions.",
        learningActivities: "Lecture, case studies.",
        resourcesAndReferences: "Kenya Prisons Service standards; WHO prison health resources.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 12,
        topicTitle: "Nutrition Surveillance and Monitoring for Vulnerable Groups",
        subTopics: [
          "Nutrition surveillance systems in Kenya: SMART surveys, NDHS, KCHS",
          "Anthropometric indicators for monitoring vulnerable groups",
          "Nutrition information systems: data collection, analysis, and use",
          "Kenya Nutrition Action Plan: targets and indicators",
          "Community-based monitoring of nutritional status"
        ],
        hours: 3,
        specificLearningOutcomes: "Describe nutrition surveillance systems; identify indicators; describe community monitoring approaches.",
        learningActivities: "Lecture, nutrition surveillance data review exercise.",
        resourcesAndReferences: "SMART survey guidelines; Kenya Nutrition Action Plan; textbooks.",
        assessmentAndRemarks: "Data review exercise, oral questions."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in Nutrition for Vulnerable Groups",
        subTopics: [
          "Emerging issues: climate change and food insecurity for vulnerable groups",
          "COVID-19 and its nutritional impact on vulnerable populations",
          "Double burden of malnutrition in vulnerable groups",
          "Challenges posed by emerging issues and trends",
          "Coping strategies: resilience programming, social protection, adaptive nutrition interventions"
        ],
        hours: 3,
        specificLearningOutcomes: "Discuss emerging issues; identify challenges; describe coping strategies for vulnerable group nutrition.",
        learningActivities: "Discussions, presentations.",
        resourcesAndReferences: "Journal articles; WHO reports; internet.",
        assessmentAndRemarks: "Oral presentation, assignment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Nutrition for Vulnerable Groups",
        subTopics: [
          "Comprehensive written theory examination covering all prescribed unit topics",
          "Case-based practical: nutritional assessment and intervention planning for a vulnerable group"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of nutrition for vulnerable groups principles.",
        learningActivities: "Supervised theory and case-based examination.",
        resourcesAndReferences: "Official examination papers; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Mahan, L. K., & Raymond, J. L. (2017). Krause's Food and the Nutrition Care Process (14th ed.). Elsevier.",
      "UNHCR/WFP. (2018). Selective Feeding Programmes in Emergency Settings.",
      "Ministry of Health, Kenya. (2019). Kenya National Nutrition Action Plan 2018–2022. Government of Kenya.",
      "WHO. (2021). Nutritional Guidelines for Clinical Practice. WHO."
    ],
    instructionalEquipment: [
      "MUAC tapes", "Weighing scales", "Growth charts",
      "Case study materials", "Whiteboard and LCD projector"
    ]
  },

  "community_diagnosis_mobilization": {
    canonicalKey: "community_diagnosis_mobilization",
    syllabusCode: "CHN 2305",
    unitCode: "CHN 2305",
    unitName: "Community Diagnosis and Mobilization",
    moduleNumber: 2,
    nominalHours: 40,
    theoryHours: 24,
    practicalHours: 16,
    aliases: ["CHN 2305", "CND 2303", "Community Diagnosis and Mobilization", "Community Diagnosis"],
    isAvailable: true,
    unitDescription: "This unit equips the trainee with knowledge and skills to conduct community nutrition diagnosis and mobilize communities for nutrition action.",
    overallCompetency: "By the end of the unit, the trainee should be able to: define community diagnosis; describe community health and nutrition assessment methods; conduct a community diagnosis; mobilize communities for nutrition and health action; plan community nutrition interventions.",
    learningOutcomes: [
      "Define community diagnosis and related terms",
      "Describe the community health and nutrition assessment process",
      "Apply community diagnosis methods: surveys, interviews, focus group discussions",
      "Identify community nutrition problems and their determinants",
      "Develop community mobilization strategies for nutrition",
      "Plan community-based nutrition interventions"
    ],
    teachingLearningApproaches: "Lectures, field visits, community surveys, group discussions, presentations.",
    assessmentApproaches: "Continuous Assessment Test (CAT); community diagnosis field report; summative examination.",
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Introduction to Community Diagnosis and Mobilization",
        subTopics: [
          "Definition of community, community diagnosis, community mobilization",
          "Importance of community diagnosis in nutrition practice",
          "Types of community diagnosis: comprehensive, rapid, focused",
          "Community health profile: demographics, epidemiology, nutrition status",
          "The community diagnosis process: steps and phases"
        ],
        hours: 3,
        specificLearningOutcomes: "Define terms; explain importance; describe types; outline community diagnosis process.",
        learningActivities: "Lecture, group discussions.",
        resourcesAndReferences: "Community diagnosis textbooks; WHO community health manuals.",
        assessmentAndRemarks: "Class quiz, oral questions."
      },
      {
        weekNumber: 2,
        topicTitle: "Community Health and Nutrition Assessment Methods",
        subTopics: [
          "Quantitative methods: surveys, anthropometric assessments, dietary assessments",
          "Qualitative methods: key informant interviews, focus group discussions, observation",
          "Participatory Rural Appraisal (PRA) tools: transect walks, resource mapping, seasonal calendar",
          "Secondary data sources: health records, nutrition surveys, census data",
          "Combining quantitative and qualitative methods"
        ],
        hours: 3,
        specificLearningOutcomes: "Describe quantitative and qualitative community diagnosis methods; use PRA tools.",
        learningActivities: "Lecture, PRA tool practical exercise.",
        resourcesAndReferences: "PRA manuals; community assessment textbooks.",
        assessmentAndRemarks: "Practical exercise, oral questions."
      },
      {
        weekNumber: 3,
        topicTitle: "Sampling and Data Collection in Community Diagnosis",
        subTopics: [
          "Sampling methods for community diagnosis: cluster, systematic, random",
          "Sample size estimation for nutrition surveys",
          "Designing community nutrition questionnaires",
          "Conducting household surveys: ethical considerations, consent",
          "Managing data collection teams: training enumerators, quality control"
        ],
        hours: 3,
        specificLearningOutcomes: "Select sampling methods; estimate sample sizes; design questionnaires; manage data collection.",
        learningActivities: "Lecture, questionnaire design exercise.",
        resourcesAndReferences: "Survey design manuals; textbooks.",
        assessmentAndRemarks: "Questionnaire design exercise."
      },
      {
        weekNumber: 4,
        topicTitle: "Community Nutrition Problem Identification and Prioritization",
        subTopics: [
          "Identifying community nutrition problems from diagnosis data",
          "Problem trees: cause-effect analysis",
          "Problem prioritization techniques: scoring, voting, ranking",
          "Causal framework for malnutrition: UNICEF conceptual framework",
          "Community validation of identified problems"
        ],
        hours: 3,
        specificLearningOutcomes: "Identify nutrition problems from community data; apply cause-effect analysis; prioritize problems using UNICEF framework.",
        learningActivities: "Lecture, problem tree exercise.",
        resourcesAndReferences: "UNICEF conceptual framework chart; community diagnosis textbooks.",
        assessmentAndRemarks: "Problem tree exercise, oral questions."
      },
      {
        weekNumber: 5,
        topicTitle: "Community Mobilization Strategies for Nutrition",
        subTopics: [
          "Definition and importance of community mobilization",
          "Steps in community mobilization: entry, assessment, planning, action, evaluation",
          "Community entry approaches: meeting with local leaders, gatekeepers",
          "Formation of community nutrition committees and mother support groups",
          "Social mobilization techniques: drama, public address, community radio"
        ],
        hours: 3,
        specificLearningOutcomes: "Define community mobilization; describe steps; apply community entry approaches; form community nutrition structures.",
        learningActivities: "Lecture, role play on community entry.",
        resourcesAndReferences: "Community mobilization manuals; textbooks.",
        assessmentAndRemarks: "Role play assessment, oral questions."
      },
      {
        weekNumber: 6,
        topicTitle: "Community-Based Nutrition Intervention Planning",
        subTopics: [
          "Community action planning: objectives, activities, resources, timeframe",
          "SMART objectives for community nutrition programmes",
          "Community nutrition intervention models: growth monitoring, community kitchens, food demonstrations",
          "Resource mapping and mobilization for community nutrition",
          "Community monitoring and evaluation planning"
        ],
        hours: 3,
        specificLearningOutcomes: "Develop SMART objectives; plan community nutrition interventions; describe monitoring and evaluation planning.",
        learningActivities: "Lecture, community action plan writing exercise.",
        resourcesAndReferences: "Community action planning guides; textbooks.",
        assessmentAndRemarks: "Community action plan draft."
      },
      {
        weekNumber: 7,
        topicTitle: "Continuous Assessment Test (CAT) — Community Diagnosis and Mobilization",
        subTopics: [
          "Written theory assessment covering topics from Weeks 1–6",
          "Post-CAT review and feedback session"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate mastery of community diagnosis and mobilization from Weeks 1–6.",
        learningActivities: "Supervised written CAT followed by plenary review.",
        resourcesAndReferences: "Examination scripts; marking keys.",
        assessmentAndRemarks: "Official Continuous Assessment Test (CAT)."
      },
      {
        weekNumber: 8,
        topicTitle: "Community Field Visit — Diagnosis in Practice",
        subTopics: [
          "Pre-field visit preparation: questionnaires, consent forms, logistics",
          "Community entry protocol: introduction to leaders and households",
          "Conducting household nutrition surveys",
          "Anthropometric assessment of under-fives in community settings",
          "Key informant interviews with community health volunteers"
        ],
        hours: 3,
        specificLearningOutcomes: "Conduct community nutrition survey; apply anthropometric assessment; conduct key informant interviews.",
        learningActivities: "Community field visit, survey administration, anthropometric assessment.",
        resourcesAndReferences: "Survey tools; anthropometric equipment; consent forms.",
        assessmentAndRemarks: "Field visit report, logbook."
      },
      {
        weekNumber: 9,
        topicTitle: "Community Field Visit — Data Analysis and Problem Identification",
        subTopics: [
          "Entering and cleaning collected community data",
          "Analysing survey data: frequencies, proportions, nutritional status",
          "Calculating and interpreting malnutrition rates",
          "Identifying key nutrition problems from community diagnosis data",
          "Preparing community diagnosis report"
        ],
        hours: 3,
        specificLearningOutcomes: "Analyse collected data; calculate malnutrition rates; identify nutrition problems; prepare community diagnosis report.",
        learningActivities: "Data analysis exercise, report writing.",
        resourcesAndReferences: "Data analysis tools; community diagnosis report template.",
        assessmentAndRemarks: "Data analysis report."
      },
      {
        weekNumber: 10,
        topicTitle: "Community Feedback and Validation",
        subTopics: [
          "Presenting community diagnosis findings to community members",
          "Community feedback meeting: facilitating discussion and validation",
          "Incorporating community perspectives into the diagnosis",
          "Building community ownership of nutrition problems",
          "Developing shared action plan with community"
        ],
        hours: 3,
        specificLearningOutcomes: "Present findings to community; facilitate validation meeting; incorporate community perspectives; develop shared action plan.",
        learningActivities: "Simulated community feedback meeting, role play.",
        resourcesAndReferences: "Community feedback guides; presentation materials.",
        assessmentAndRemarks: "Feedback meeting simulation assessment."
      },
      {
        weekNumber: 11,
        topicTitle: "Community Nutrition Programme Implementation and Monitoring",
        subTopics: [
          "Implementing community nutrition interventions: nutrition education, cooking demonstrations, growth monitoring",
          "Monitoring community nutrition programme activities",
          "Community nutrition registers and records",
          "Supportive supervision for community health volunteers",
          "Handling challenges in community nutrition programme implementation"
        ],
        hours: 3,
        specificLearningOutcomes: "Implement community nutrition activities; monitor programme; describe CHV supervision.",
        learningActivities: "Practical community nutrition activity implementation, monitoring exercise.",
        resourcesAndReferences: "Community nutrition registers; supervision checklists.",
        assessmentAndRemarks: "Community nutrition activity assessment."
      },
      {
        weekNumber: 12,
        topicTitle: "Advocacy and Partnership for Community Nutrition",
        subTopics: [
          "Advocacy for community nutrition: policy and resource mobilization",
          "Building partnerships: county health departments, NGOs, faith-based organizations",
          "Community nutrition networks and coordination platforms",
          "Scaling up successful community nutrition interventions",
          "Documentation and sharing of community nutrition best practices"
        ],
        hours: 3,
        specificLearningOutcomes: "Describe advocacy approaches; build partnerships; identify coordination mechanisms.",
        learningActivities: "Lecture, case studies on successful community nutrition programmes.",
        resourcesAndReferences: "Advocacy guides; partnership models; textbooks.",
        assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in Community Diagnosis and Mobilization",
        subTopics: [
          "Emerging issues: digital health and community diagnosis, mHealth applications",
          "Community empowerment and rights-based approaches to nutrition",
          "Climate change and community nutrition vulnerability",
          "Challenges and coping strategies for community mobilization"
        ],
        hours: 3,
        specificLearningOutcomes: "Discuss emerging issues; describe mHealth applications in community diagnosis; identify coping strategies.",
        learningActivities: "Discussions, presentations.",
        resourcesAndReferences: "Journal articles; mHealth resources; internet.",
        assessmentAndRemarks: "Oral presentation, assignment."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Community Diagnosis and Mobilization",
        subTopics: [
          "Comprehensive written theory examination covering all prescribed unit topics",
          "Practical: community diagnosis report presentation"
        ],
        hours: 3,
        specificLearningOutcomes: "Demonstrate comprehensive mastery of community diagnosis and mobilization principles.",
        learningActivities: "Supervised theory examination and community diagnosis report presentation.",
        resourcesAndReferences: "Official examination papers; marking rubrics.",
        assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "WHO. (2018). Community Engagement Framework for Quality, People-Centred and Resilient Health Services. WHO.",
      "Ministry of Health, Kenya. (2019). National Community Health Strategy. Government of Kenya.",
      "UNICEF. (2021). A Conceptual Framework for Analysing the Determinants of Child Malnutrition."
    ],
    instructionalEquipment: [
      "Survey questionnaires", "Anthropometric equipment",
      "PRA tools", "Whiteboard and LCD projector"
    ]
  },

  "nutrition_care_process": {
    canonicalKey: "nutrition_care_process",
    syllabusCode: "CHN 1304",
    unitCode: "CHN 1304",
    unitName: "Introduction to Nutrition Care Process",
    moduleNumber: 1,
    nominalHours: 40,
    theoryHours: 24,
    practicalHours: 16,
    aliases: ["CHN 1304", "CND 1206", "DND 1206", "Introduction to Nutrition Care Process", "Nutrition Care Process"],
    isAvailable: true,
    unitDescription: "This unit equips the trainee with knowledge and skills to apply the nutrition care process in individual and community nutrition practice.",
    overallCompetency: "By the end of the unit, the trainee should be able to: define and describe the nutrition care process; conduct nutritional assessment; formulate nutrition diagnoses; plan and implement nutrition interventions; monitor and evaluate nutrition outcomes.",
    learningOutcomes: [
      "Define the nutrition care process and related terms",
      "Conduct nutritional assessment: anthropometric, biochemical, clinical, dietary (ABCD)",
      "Formulate a nutrition diagnosis using the PES statement",
      "Plan appropriate nutrition interventions",
      "Implement nutrition interventions: counselling, education, therapeutic diets",
      "Monitor and evaluate nutrition outcomes"
    ],
    teachingLearningApproaches: "Lectures, case studies, practical nutritional assessments, clinical demonstrations.",
    assessmentApproaches: "Continuous Assessment Test (CAT); nutrition care plan case study; summative examination.",
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Introduction to the Nutrition Care Process",
        subTopics: ["Definition and components of the nutrition care process", "History and importance of the NCP in clinical nutrition practice", "Overview of ADIME: Assessment, Diagnosis, Intervention, Monitoring and Evaluation", "Standardized language in nutrition care: IDNT terminology"],
        hours: 3, specificLearningOutcomes: "Define NCP and components; describe ADIME framework.",
        learningActivities: "Lecture, group discussions.", resourcesAndReferences: "Academy of Nutrition and Dietetics IDNT reference manual; textbooks.", assessmentAndRemarks: "Class quiz."
      },
      {
        weekNumber: 2,
        topicTitle: "Nutritional Assessment — Anthropometric Methods",
        subTopics: ["Anthropometric measurements: weight, height, BMI, MUAC, skinfold thickness", "Growth charts: weight-for-age, height-for-age, weight-for-height", "Interpretation of anthropometric indices: z-scores and percentiles", "Malnutrition classification: SAM, MAM, stunting, wasting, underweight, overweight"],
        hours: 3, specificLearningOutcomes: "Conduct anthropometric measurements; interpret growth charts and z-scores; classify malnutrition.",
        learningActivities: "Practical anthropometric measurement.", resourcesAndReferences: "Anthropometric equipment; WHO growth charts.", assessmentAndRemarks: "Practical assessment."
      },
      {
        weekNumber: 3,
        topicTitle: "Nutritional Assessment — Biochemical and Clinical Methods",
        subTopics: ["Biochemical markers of nutritional status: haemoglobin, serum albumin, ferritin, vitamin levels", "Interpreting laboratory results in nutrition assessment", "Clinical signs of nutritional deficiencies: hair, skin, eye, mouth, nails", "Clinical assessment tools: nutritional risk screening (NRS 2002, MUST)"],
        hours: 3, specificLearningOutcomes: "Interpret biochemical markers; identify clinical signs of deficiency; apply screening tools.",
        learningActivities: "Lecture, case studies, clinical sign identification practical.", resourcesAndReferences: "Clinical nutrition textbooks; laboratory reference ranges.", assessmentAndRemarks: "Case study analysis."
      },
      {
        weekNumber: 4,
        topicTitle: "Nutritional Assessment — Dietary Methods",
        subTopics: ["24-hour dietary recall: administration, portion estimation, recording", "Food frequency questionnaire: design and administration", "Dietary diversity score: WDDS, HDDS, IDDS", "Food record and duplicate portion methods", "Analysing dietary intake: food composition tables, NutriSurvey software"],
        hours: 3, specificLearningOutcomes: "Administer dietary recall and FFQ; calculate dietary diversity score; analyse dietary intake.",
        learningActivities: "Dietary recall practical, FFQ administration.", resourcesAndReferences: "Dietary assessment tools; food composition tables.", assessmentAndRemarks: "Dietary recall exercise."
      },
      {
        weekNumber: 5,
        topicTitle: "Nutrition Diagnosis — PES Statements",
        subTopics: ["Nutrition diagnosis vs. medical diagnosis", "Components of a nutrition diagnosis: Problem, Etiology, Signs/Symptoms (PES)", "NCP nutrition diagnostic terminology: intake, clinical, behavioural domains", "Writing PES statements for common nutrition diagnoses", "Prioritizing nutrition diagnoses"],
        hours: 3, specificLearningOutcomes: "Formulate PES statements for common nutrition diagnoses; prioritize diagnoses.",
        learningActivities: "Lecture, PES statement writing exercise.", resourcesAndReferences: "IDNT reference manual; case studies.", assessmentAndRemarks: "PES statement exercise."
      },
      {
        weekNumber: 6,
        topicTitle: "Nutrition Intervention Planning",
        subTopics: ["Types of nutrition interventions: food and nutrient delivery, nutrition education and counselling, coordination of care", "Setting nutrition goals and expected outcomes", "Nutrition prescription: calculating energy, protein, and micronutrient needs", "Selecting nutrition interventions: evidence-based practice", "Documentation of nutrition care plans"],
        hours: 3, specificLearningOutcomes: "Plan nutrition interventions; calculate nutrient prescriptions; document nutrition care plans.",
        learningActivities: "Lecture, nutrition care plan development exercise.", resourcesAndReferences: "Clinical nutrition textbooks; diet calculation worksheets.", assessmentAndRemarks: "Nutrition care plan submission."
      },
      {
        weekNumber: 7,
        topicTitle: "Continuous Assessment Test (CAT) — Nutrition Care Process",
        subTopics: ["Written theory assessment covering topics from Weeks 1–6", "Post-CAT review and feedback session"],
        hours: 3, specificLearningOutcomes: "Demonstrate mastery of NCP concepts from Weeks 1–6.",
        learningActivities: "Supervised written CAT, plenary review.", resourcesAndReferences: "Examination scripts; marking keys.", assessmentAndRemarks: "CAT."
      },
      {
        weekNumber: 8,
        topicTitle: "Nutrition Intervention Implementation — Counselling",
        subTopics: ["Nutrition counselling within the NCP framework", "Motivational interviewing applied to nutrition counselling", "Practising a nutrition counselling session based on a PES diagnosis", "Documentation of counselling outcomes", "Referral and coordination with other health professionals"],
        hours: 3, specificLearningOutcomes: "Conduct NCP-based nutrition counselling sessions; document outcomes; make referrals.",
        learningActivities: "Role play counselling sessions, peer feedback.", resourcesAndReferences: "Counselling manuals; IDNT reference.", assessmentAndRemarks: "Counselling role play assessment."
      },
      {
        weekNumber: 9,
        topicTitle: "Nutrition Monitoring and Evaluation",
        subTopics: ["Nutrition monitoring: anthropometric, biochemical, dietary indicators", "Nutrition outcome categories: food and nutrition-related history, anthropometric, biochemical, clinical", "Evaluating progress towards nutrition goals", "Documenting monitoring and evaluation in SOAP or ADIME format", "Adjusting the nutrition care plan based on M&E findings"],
        hours: 3, specificLearningOutcomes: "Apply monitoring indicators; document M&E in SOAP/ADIME; adjust nutrition care plan.",
        learningActivities: "Lecture, case study M&E exercise.", resourcesAndReferences: "Clinical nutrition textbooks; IDNT manual.", assessmentAndRemarks: "Case study M&E report."
      },
      {
        weekNumber: 10,
        topicTitle: "NCP in Community Settings",
        subTopics: ["Applying the NCP in community nutrition practice", "Community-level nutrition assessment: SMART surveys, rapid assessments", "Nutrition diagnosis at population level: burden of malnutrition", "Community nutrition interventions within the NCP framework", "Monitoring and evaluation of community nutrition programmes"],
        hours: 3, specificLearningOutcomes: "Apply NCP at community level; describe population-level nutrition diagnosis; plan M&E.",
        learningActivities: "Lecture, community case study.", resourcesAndReferences: "Community nutrition manuals; textbooks.", assessmentAndRemarks: "Community case study analysis."
      },
      {
        weekNumber: 11,
        topicTitle: "NCP in Clinical Settings — Case Studies",
        subTopics: ["Applying the NCP for patients with malnutrition, diabetes, renal disease, HIV/AIDS, cancer", "Full NCP case study from assessment to M&E", "Interprofessional nutrition care team collaboration", "Electronic nutrition care records: Health Management Information Systems (HMIS)"],
        hours: 3, specificLearningOutcomes: "Apply full NCP in clinical case studies across disease conditions.",
        learningActivities: "Clinical case study group work.", resourcesAndReferences: "Case study portfolios; clinical nutrition textbooks.", assessmentAndRemarks: "Clinical case study assessment."
      },
      {
        weekNumber: 12,
        topicTitle: "Ethical and Legal Aspects of Nutrition Care",
        subTopics: ["Ethical principles in nutrition care: autonomy, beneficence, non-maleficence, justice", "Informed consent in nutrition practice", "Confidentiality and privacy of patient nutrition records", "Legal liability in nutrition counselling and advice", "Professional conduct and scope of practice for nutritionists and dietitians"],
        hours: 3, specificLearningOutcomes: "Describe ethical principles; apply informed consent; describe legal liability in nutrition practice.",
        learningActivities: "Lecture, case studies on ethics.", resourcesAndReferences: "Medical ethics textbooks; Kenya nutritionist regulations.", assessmentAndRemarks: "Case study, oral questions."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in the Nutrition Care Process",
        subTopics: ["Emerging issues: precision nutrition and genomic nutrition", "Electronic health records and digital NCP documentation", "Telehealth and remote nutrition counselling", "Evidence-based practice updates in NCP"],
        hours: 3, specificLearningOutcomes: "Discuss emerging NCP trends; describe digital NCP tools; explain precision nutrition.",
        learningActivities: "Discussions, presentations.", resourcesAndReferences: "Journal articles; AND NCP updates.", assessmentAndRemarks: "Oral presentation."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Nutrition Care Process",
        subTopics: ["Comprehensive written theory examination", "Practical: full NCP case study from assessment to M&E"],
        hours: 3, specificLearningOutcomes: "Demonstrate comprehensive mastery of the NCP.",
        learningActivities: "Supervised theory and practical examination.", resourcesAndReferences: "Official examination papers; marking rubrics.", assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Academy of Nutrition and Dietetics. (2022). International Dietetics and Nutrition Terminology (IDNT) Reference Manual (6th ed.). AND.",
      "Mahan, L. K., & Raymond, J. L. (2017). Krause's Food and the Nutrition Care Process (14th ed.). Elsevier."
    ],
    instructionalEquipment: ["Anthropometric equipment", "Dietary assessment tools", "Case study portfolios", "Whiteboard and LCD projector"]
  },

  "management_of_malnutrition": {
    canonicalKey: "management_of_malnutrition",
    syllabusCode: "CHN 2202",
    unitCode: "CHN 2202",
    unitName: "Management of Malnutrition",
    moduleNumber: 2,
    nominalHours: 40,
    theoryHours: 24,
    practicalHours: 16,
    aliases: ["CHN 2202", "CND 2101", "DND 2101", "Management of Malnutrition", "Malnutrition Management"],
    isAvailable: true,
    unitDescription: "This unit equips the trainee with knowledge and skills to assess, classify, and manage malnutrition in community and clinical settings.",
    overallCompetency: "By the end of the unit, the trainee should be able to: define and classify malnutrition; conduct nutritional assessment for malnutrition; manage protein-energy malnutrition; manage micronutrient deficiencies; apply inpatient and outpatient therapeutic feeding protocols.",
    learningOutcomes: [
      "Define malnutrition and classify its types",
      "Conduct nutritional assessment for malnutrition classification",
      "Describe the pathophysiology of protein-energy malnutrition",
      "Apply IMAM protocols for community-based management of acute malnutrition",
      "Manage inpatient stabilization and rehabilitation of SAM",
      "Describe micronutrient deficiency management",
      "Plan therapeutic feeding programmes"
    ],
    teachingLearningApproaches: "Lectures, clinical demonstrations, case studies, IMAM practical exercises.",
    assessmentApproaches: "Continuous Assessment Test (CAT); clinical case study; summative examination.",
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Introduction to Malnutrition",
        subTopics: ["Definition and classification of malnutrition: undernutrition, overnutrition, micronutrient deficiencies", "Types: wasting (acute), stunting (chronic), underweight, overweight, obesity", "Double burden of malnutrition", "Global and Kenya malnutrition burden: prevalence and trends", "UNICEF conceptual framework for malnutrition causes"],
        hours: 3, specificLearningOutcomes: "Define and classify malnutrition; describe global and Kenya burden; apply UNICEF framework.",
        learningActivities: "Lecture, group discussions.", resourcesAndReferences: "UNICEF conceptual framework; Kenya SMART survey data; textbooks.", assessmentAndRemarks: "Class quiz."
      },
      {
        weekNumber: 2,
        topicTitle: "Nutritional Assessment for Malnutrition",
        subTopics: ["Anthropometric assessment: MUAC, weight-for-height, weight-for-age, height-for-age", "WHO and IMAM cut-offs for SAM and MAM: MUAC (<115mm SAM), WHZ (<-3), bilateral pitting oedema", "Appetite test: RUTF appetite test for SAM screening", "Clinical assessment: medical complications in malnourished children"],
        hours: 3, specificLearningOutcomes: "Conduct anthropometric assessment; classify SAM/MAM; apply appetite test.",
        learningActivities: "Practical anthropometric assessment, appetite test demonstration.", resourcesAndReferences: "MUAC tapes; RUTF; anthropometric equipment.", assessmentAndRemarks: "Practical assessment."
      },
      {
        weekNumber: 3,
        topicTitle: "Pathophysiology of Protein-Energy Malnutrition",
        subTopics: ["Types of PEM: kwashiorkor, marasmus, marasmic-kwashiorkor", "Physiological changes in SAM: immune suppression, metabolic disturbances, organ dysfunction", "Infection and malnutrition cycle", "The refeeding syndrome: risk, pathophysiology, prevention", "Electrolyte imbalances in SAM: hyponatraemia, hypokalaemia, hypoglycaemia"],
        hours: 3, specificLearningOutcomes: "Describe types of PEM; explain physiological changes; describe refeeding syndrome.",
        learningActivities: "Lecture, clinical case study.", resourcesAndReferences: "WHO SAM management guidelines; clinical nutrition textbooks.", assessmentAndRemarks: "Case study analysis."
      },
      {
        weekNumber: 4,
        topicTitle: "IMAM — Community-Based Management of Acute Malnutrition (SAM Outpatient)",
        subTopics: ["IMAM programme components: outpatient therapeutic programme (OTP), supplementary feeding programme (SFP), stabilization centre (SC)", "OTP eligibility criteria for SAM without complications", "RUTF (Ready-to-Use Therapeutic Food): composition, dosage, home use instructions", "OTP protocol: weekly weight gain targets, discharge criteria", "Home visit and follow-up in OTP"],
        hours: 3, specificLearningOutcomes: "Describe IMAM components; apply OTP eligibility criteria; calculate RUTF doses; explain discharge criteria.",
        learningActivities: "Lecture, OTP registration card exercise, RUTF demonstration.", resourcesAndReferences: "Kenya IMAM guidelines; RUTF samples; OTP records.", assessmentAndRemarks: "IMAM protocol exercise."
      },
      {
        weekNumber: 5,
        topicTitle: "IMAM — Management of Moderate Acute Malnutrition (SFP)",
        subTopics: ["SFP eligibility: MAM criteria (MUAC 115–124mm, WHZ -2 to -3)", "Types of supplementary feeding: targeted SFP, blanket SFP", "Fortified blended food (FBF) rations: Super Cereal, Super Cereal Plus", "SFP ration distribution, monitoring and follow-up", "Transition from SFP to general ration after recovery"],
        hours: 3, specificLearningOutcomes: "Apply SFP eligibility criteria; describe FBF rations; explain SFP monitoring and follow-up.",
        learningActivities: "Lecture, SFP case exercise.", resourcesAndReferences: "Kenya IMAM guidelines; FBF samples.", assessmentAndRemarks: "SFP case study."
      },
      {
        weekNumber: 6,
        topicTitle: "Inpatient Management of SAM — Stabilization Phase",
        subTopics: ["Criteria for inpatient SAM management: complications (hypoglycaemia, hypothermia, severe anaemia, dehydration)", "10 steps of SAM management: WHO protocol", "F75 therapeutic milk: composition, preparation, volume calculation", "Management of hypoglycaemia, hypothermia, and dehydration in SAM", "Infection management: antibiotics, malaria, TB screening"],
        hours: 3, specificLearningOutcomes: "Apply 10 steps of SAM management; calculate F75 volumes; manage SAM complications.",
        learningActivities: "Lecture, F75 preparation practical, clinical simulation.", resourcesAndReferences: "WHO SAM management guidelines; F75 therapeutic milk.", assessmentAndRemarks: "Simulation clinical case."
      },
      {
        weekNumber: 7,
        topicTitle: "Continuous Assessment Test (CAT) — Management of Malnutrition",
        subTopics: ["Written theory assessment covering topics from Weeks 1–6", "Post-CAT review and feedback session"],
        hours: 3, specificLearningOutcomes: "Demonstrate mastery of malnutrition management from Weeks 1–6.",
        learningActivities: "Supervised written CAT, plenary review.", resourcesAndReferences: "Examination scripts; marking keys.", assessmentAndRemarks: "CAT."
      },
      {
        weekNumber: 8,
        topicTitle: "Inpatient SAM Management — Rehabilitation Phase and Transition",
        subTopics: ["Transition from F75 to F100: criteria and timing", "F100 therapeutic milk: composition and volume", "Appetite recovery and RUTF introduction in rehabilitation", "Catch-up growth: expected weight gain rates", "Discharge criteria from inpatient SAM management and transition to OTP"],
        hours: 3, specificLearningOutcomes: "Describe transition from F75 to F100; explain RUTF introduction; apply discharge criteria.",
        learningActivities: "Lecture, clinical case study.", resourcesAndReferences: "WHO SAM management guidelines; F100 therapeutic milk.", assessmentAndRemarks: "Clinical case study."
      },
      {
        weekNumber: 9,
        topicTitle: "Management of Micronutrient Deficiency Disorders",
        subTopics: ["Iron deficiency anaemia: assessment, management, prevention", "Iodine deficiency disorders: goitre, cretinism — prevention with iodized salt", "Vitamin A deficiency: xerophthalmia, prevention through supplementation and dietary diversification", "Zinc deficiency: growth stunting, diarrhoea — management", "Scurvy (Vitamin C deficiency) and pellagra (Niacin): diagnosis and treatment"],
        hours: 3, specificLearningOutcomes: "Describe and manage iron, iodine, vitamin A, zinc, and other micronutrient deficiencies.",
        learningActivities: "Lecture, micronutrient deficiency case studies.", resourcesAndReferences: "WHO micronutrient guidelines; Kenya vitamin A supplementation guidelines.", assessmentAndRemarks: "Case study analysis."
      },
      {
        weekNumber: 10,
        topicTitle: "Prevention of Malnutrition — Community and Policy Interventions",
        subTopics: ["Primary prevention of malnutrition: dietary diversification, optimal IYCF, micronutrient supplementation", "Food fortification: salt iodization, flour fortification, oil fortification", "Growth monitoring and promotion (GMP) as a preventive strategy", "Social protection and safety nets: cash transfers, school feeding programmes", "National nutrition policies: Kenya National Nutrition Action Plan"],
        hours: 3, specificLearningOutcomes: "Describe primary prevention strategies; explain food fortification; describe social protection for nutrition.",
        learningActivities: "Lecture, nutrition policy discussion.", resourcesAndReferences: "Kenya NNAP; WHO nutrition prevention guidelines.", assessmentAndRemarks: "Oral questions."
      },
      {
        weekNumber: 11,
        topicTitle: "Nutrition Rehabilitation Centres and Therapeutic Feeding Programmes",
        subTopics: ["Nutrition Rehabilitation Centre (NRC): purpose, target population, services", "Therapeutic feeding programme (TFP) design and management", "Monitoring TFP outcomes: cure rate, death rate, default rate, non-response rate (SPHERE standards)", "Documenting and reporting TFP programme performance"],
        hours: 3, specificLearningOutcomes: "Describe NRC operations; manage TFP; monitor programme outcomes using Sphere standards.",
        learningActivities: "Lecture, TFP performance data review exercise.", resourcesAndReferences: "Sphere Handbook; IMAM guidelines.", assessmentAndRemarks: "TFP data review exercise."
      },
      {
        weekNumber: 12,
        topicTitle: "Malnutrition in Specific Populations",
        subTopics: ["Malnutrition in adolescents: stunting, anaemia, eating disorders", "Malnutrition in adults with HIV, TB, cancer", "Malnutrition in the elderly: sarcopenia, micronutrient deficiencies", "Malnutrition in hospital settings: hospital-acquired malnutrition, nutritional support"],
        hours: 3, specificLearningOutcomes: "Describe and manage malnutrition in specific population groups across life stages.",
        learningActivities: "Lecture, case studies.", resourcesAndReferences: "Clinical nutrition textbooks; WHO specialized guidelines.", assessmentAndRemarks: "Case study analysis."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in Malnutrition Management",
        subTopics: ["Emerging issues: new RUTF formulations, home-grown RUTF initiatives", "Emerging evidence on early childhood stunting prevention", "Digital health tools in IMAM monitoring", "Challenges and opportunities in malnutrition scale-up"],
        hours: 3, specificLearningOutcomes: "Discuss emerging issues; describe new RUTF developments; identify coping strategies.",
        learningActivities: "Presentations, discussions, journal reviews.", resourcesAndReferences: "Journal articles; IMAM programme updates.", assessmentAndRemarks: "Oral presentation."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Management of Malnutrition",
        subTopics: ["Comprehensive written theory examination", "Practical: IMAM clinical case study assessment"],
        hours: 3, specificLearningOutcomes: "Demonstrate comprehensive mastery of malnutrition management.",
        learningActivities: "Supervised theory and clinical case examination.", resourcesAndReferences: "Official examination papers; marking rubrics.", assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "WHO. (2013). Guideline: Updates on the Management of Severe Acute Malnutrition in Infants and Children. WHO.",
      "Ministry of Health, Kenya. (2020). Integrated Management of Acute Malnutrition (IMAM) Guidelines. Government of Kenya.",
      "Mahan, L. K., & Raymond, J. L. (2017). Krause's Food and the Nutrition Care Process (14th ed.). Elsevier."
    ],
    instructionalEquipment: [
      "MUAC tapes", "Weighing scales", "RUTF samples",
      "F75 and F100 therapeutic milk", "Anthropometric equipment",
      "IMAM programme records", "Whiteboard and LCD projector"
    ]
  },

  "agricultural_production": {
    canonicalKey: "agricultural_production",
    syllabusCode: "CHN 2309",
    unitCode: "CHN 2309",
    unitName: "Agricultural Production",
    moduleNumber: 2,
    nominalHours: 40,
    theoryHours: 20,
    practicalHours: 20,
    aliases: ["CHN 2309", "CND 2306", "DND 3205", "Agricultural Production", "Agriculture"],
    isAvailable: true,
    unitDescription: "This unit equips the trainee with knowledge and skills in agricultural production for improved household food security and nutrition.",
    overallCompetency: "By the end of the unit, the trainee should be able to: describe principles of crop and animal production; apply soil management practices; grow and manage food crops and vegetables; rear food animals; and relate agricultural production to household food security and nutrition.",
    learningOutcomes: [
      "Describe principles and importance of agricultural production for nutrition",
      "Describe soil management and preparation for food crop growing",
      "Grow food crops and vegetables using appropriate production methods",
      "Apply integrated pest and disease management",
      "Rear food animals: poultry, small ruminants, fish",
      "Relate agricultural production to household food security and nutrition"
    ],
    teachingLearningApproaches: "Lectures, farm practicals, field visits, demonstrations, group discussions.",
    assessmentApproaches: "Continuous Assessment Test (CAT); farm practical assessment; summative examination.",
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Introduction to Agricultural Production for Food and Nutrition",
        subTopics: ["Definition and importance of agricultural production for nutrition and food security", "Classification of agriculture: subsistence, commercial, mixed farming", "Types of farming systems: monoculture, polyculture, intercropping, agroforestry", "Agriculture-nutrition linkages: food systems and diet diversity", "Overview of Kenyan agricultural landscape"],
        hours: 3, specificLearningOutcomes: "Define agricultural production; explain importance for nutrition; describe farming systems; explain agriculture-nutrition linkages.",
        learningActivities: "Lecture, group discussions, field tour.", resourcesAndReferences: "Agricultural production textbooks; charts.", assessmentAndRemarks: "Class quiz."
      },
      {
        weekNumber: 2,
        topicTitle: "Soil Management and Land Preparation",
        subTopics: ["Soil types and their characteristics: clay, sand, loam", "Soil pH: importance for crop production and amendment methods", "Soil fertility: organic matter, composting, green manure", "Land preparation methods: primary and secondary tillage", "Raised beds, terracing, and conservation agriculture"],
        hours: 3, specificLearningOutcomes: "Describe soil types; adjust soil pH; manage soil fertility; prepare land for food crops.",
        learningActivities: "Lecture, practical soil testing and land preparation.", resourcesAndReferences: "Soil testing kits; compost; garden tools.", assessmentAndRemarks: "Practical land preparation assessment."
      },
      {
        weekNumber: 3,
        topicTitle: "Food Crop Production — Cereals and Legumes",
        subTopics: ["Nutritionally important food crops: maize, sorghum, millet, rice, wheat, cassava, sweet potato", "Legumes for food and nutrition: beans, lentils, cowpeas, groundnuts, soy", "Crop selection, seed quality, and planting methods", "Fertilizer application: organic and inorganic", "Crop spacing, thinning, and mulching"],
        hours: 3, specificLearningOutcomes: "Identify nutritionally important food crops; apply crop production practices; grow cereals and legumes.",
        learningActivities: "Lecture, farm practical: planting cereals and legumes.", resourcesAndReferences: "Seeds; garden tools; compost; textbooks.", assessmentAndRemarks: "Practical farm assessment."
      },
      {
        weekNumber: 4,
        topicTitle: "Vegetable and Fruit Production",
        subTopics: ["Nutritionally important vegetables: kale, spinach, amaranth, tomatoes, onions, carrots, pumpkin", "Orange-fleshed sweet potato: production and nutrition benefits", "Fruit production: bananas, mangoes, avocados, papaya", "Nursery establishment: seedling raising and transplanting", "Kitchen gardening: planning and establishment"],
        hours: 3, specificLearningOutcomes: "Identify nutritionally important vegetables and fruits; establish nursery; practice kitchen gardening.",
        learningActivities: "Lecture, practical nursery establishment and kitchen garden.", resourcesAndReferences: "Seeds; seedling trays; garden tools.", assessmentAndRemarks: "Practical nursery and kitchen garden assessment."
      },
      {
        weekNumber: 5,
        topicTitle: "Integrated Crop Pest and Disease Management",
        subTopics: ["Common crop pests: aphids, stem borers, thrips, mites", "Common crop diseases: leaf rust, blight, wilt, mosaic virus", "Integrated Pest Management (IPM): cultural, biological, physical, chemical control", "Safe use of pesticides: handling, protective equipment, storage", "Organic pest control methods: neem extracts, companion planting"],
        hours: 3, specificLearningOutcomes: "Identify common crop pests and diseases; apply IPM principles; use pesticides safely.",
        learningActivities: "Lecture, field identification practical.", resourcesAndReferences: "IPM manuals; crop pest identification charts.", assessmentAndRemarks: "Pest identification exercise."
      },
      {
        weekNumber: 6,
        topicTitle: "Water Management in Agricultural Production",
        subTopics: ["Irrigation methods: drip irrigation, sprinkler, flood irrigation", "Water harvesting: roof catchment, sand dams, water pans", "Mulching for moisture conservation", "Drought-tolerant crops for ASAL areas", "Water quality for irrigation: safety for food crops"],
        hours: 3, specificLearningOutcomes: "Describe irrigation methods; apply water harvesting; identify drought-tolerant crops.",
        learningActivities: "Lecture, practical irrigation demonstration.", resourcesAndReferences: "Irrigation equipment; water management manuals.", assessmentAndRemarks: "Practical assessment."
      },
      {
        weekNumber: 7,
        topicTitle: "Continuous Assessment Test (CAT) — Agricultural Production",
        subTopics: ["Written theory assessment covering topics from Weeks 1–6", "Post-CAT review and feedback session"],
        hours: 3, specificLearningOutcomes: "Demonstrate mastery of agricultural production from Weeks 1–6.",
        learningActivities: "Supervised written CAT, plenary review.", resourcesAndReferences: "Examination scripts; marking keys.", assessmentAndRemarks: "CAT."
      },
      {
        weekNumber: 8,
        topicTitle: "Poultry Production for Food and Nutrition",
        subTopics: ["Types of poultry: chickens, ducks, turkeys, guinea fowl", "Indigenous chicken vs. exotic breeds: production comparison", "Poultry housing: types, ventilation, biosecurity", "Poultry feeding: types of feeds, feeding programmes, feed formulation basics", "Poultry health management: vaccination schedule, common diseases"],
        hours: 3, specificLearningOutcomes: "Describe poultry types and breeds; design poultry housing; manage poultry feeding and health.",
        learningActivities: "Lecture, practical poultry keeping at college farm.", resourcesAndReferences: "Poultry management manuals; college farm.", assessmentAndRemarks: "Farm practical assessment."
      },
      {
        weekNumber: 9,
        topicTitle: "Small Animal and Ruminant Production",
        subTopics: ["Rabbits: breeds, housing, feeding, health, nutritional benefits of rabbit meat", "Goats and sheep: breeds, housing, feeding, milk and meat production", "Dairy goats: nutrition benefits, milking and milk hygiene", "Guinea pigs and rabbits as protein sources for nutritionally vulnerable communities"],
        hours: 3, specificLearningOutcomes: "Describe small ruminant and rabbit production; explain nutritional benefits.",
        learningActivities: "Lecture, farm practical.", resourcesAndReferences: "Animal production manuals; college farm.", assessmentAndRemarks: "Farm practical assessment."
      },
      {
        weekNumber: 10,
        topicTitle: "Fish Farming (Aquaculture) for Nutrition",
        subTopics: ["Importance of fish in nutrition: high-quality protein, omega-3 fatty acids, micronutrients", "Types of fish farming: pond culture, cage culture, tank culture", "Common fish species in Kenya: tilapia, catfish", "Fish pond design, stocking, and management", "Fish feeding and harvesting"],
        hours: 3, specificLearningOutcomes: "Describe importance of fish in nutrition; describe fish farming methods; manage a fish pond.",
        learningActivities: "Lecture, fish pond visit or practical.", resourcesAndReferences: "Aquaculture manuals; fisheries extension resources.", assessmentAndRemarks: "Practical assessment."
      },
      {
        weekNumber: 11,
        topicTitle: "Post-Harvest Handling and Storage",
        subTopics: ["Post-harvest losses in Kenya: causes and impact on food security", "Post-harvest handling of cereals: threshing, drying, sorting, grading", "Storage methods: granaries, silos, hermetic bags, cold storage", "Aflatoxin: formation, detection, prevention", "Post-harvest handling of vegetables and fruits: cooling, packaging, market"],
        hours: 3, specificLearningOutcomes: "Describe post-harvest losses; apply post-harvest handling and storage methods; prevent aflatoxin.",
        learningActivities: "Lecture, post-harvest handling practical.", resourcesAndReferences: "Post-harvest manuals; hermetic bags; drying equipment.", assessmentAndRemarks: "Practical assessment."
      },
      {
        weekNumber: 12,
        topicTitle: "Agricultural Production and Household Food Security and Nutrition",
        subTopics: ["Linking agricultural production to dietary diversity and nutrition outcomes", "Homestead food production models: crop-livestock integration", "Gender and agriculture: women's role in food production and nutrition", "Market linkages: selling surplus produce for income and improved nutrition", "Climate-smart agriculture: resilience for food security"],
        hours: 3, specificLearningOutcomes: "Link agricultural production to dietary diversity; describe homestead models; explain climate-smart agriculture.",
        learningActivities: "Lecture, case studies, farm planning exercise.", resourcesAndReferences: "Agriculture-nutrition linkage resources; textbooks.", assessmentAndRemarks: "Farm planning exercise."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in Agricultural Production",
        subTopics: ["Emerging issues: climate change and agricultural production", "Biofortified crops: orange-fleshed sweet potato, vitamin A maize, iron-rich beans", "Organic farming and its nutritional implications", "Technology in agriculture: mobile apps, precision agriculture"],
        hours: 3, specificLearningOutcomes: "Discuss emerging issues; describe biofortification; explain organic farming and technology.",
        learningActivities: "Discussions, presentations.", resourcesAndReferences: "Journal articles; HarvestPlus resources.", assessmentAndRemarks: "Oral presentation."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Agricultural Production",
        subTopics: ["Comprehensive written theory examination", "Practical: farm management demonstration"],
        hours: 3, specificLearningOutcomes: "Demonstrate comprehensive mastery of agricultural production principles.",
        learningActivities: "Supervised theory and farm practical examination.", resourcesAndReferences: "Official examination papers; marking rubrics.", assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "FAO. (2020). Sustainable Food and Agriculture. Food and Agriculture Organization.",
      "Sanchez, P. A. (2010). Tripling Crop Yields in Tropical Africa. Nature Geoscience.",
      "HarvestPlus. (2021). Biofortification Priority Index. CGIAR."
    ],
    instructionalEquipment: [
      "Garden tools (hoes, rakes, watering cans)", "Seeds and seedling trays",
      "Composting materials", "Poultry management equipment",
      "Fish pond or aquaculture resources", "Whiteboard and LCD projector"
    ]
  },

  "applied_biological_sciences": {
    canonicalKey: "applied_biological_sciences",
    syllabusCode: "CHN 1303",
    unitCode: "CHN 1303",
    unitName: "Applied Biological Sciences",
    moduleNumber: 1,
    nominalHours: 40,
    theoryHours: 24,
    practicalHours: 16,
    aliases: ["CHN 1303", "CND 2107", "Applied Biological Sciences", "Biological Sciences"],
    isAvailable: true,
    unitDescription: "This unit equips the trainee with knowledge of biological sciences relevant to nutrition and health practice.",
    overallCompetency: "By the end of the unit, the trainee should be able to: describe cell biology and its relevance to nutrition; explain genetics and heredity; describe the principles of ecology; explain evolutionary biology as it relates to human nutrition; apply biological sciences knowledge in nutrition practice.",
    learningOutcomes: [
      "Describe cell structure and function in relation to nutrition",
      "Explain genetics, heredity, and their nutritional relevance",
      "Describe principles of ecology and their relation to food systems",
      "Explain evolution and its relevance to human nutrition",
      "Apply biological sciences concepts in nutrition practice"
    ],
    teachingLearningApproaches: "Lectures, laboratory practicals, group discussions, field observations.",
    assessmentApproaches: "Continuous Assessment Test (CAT); laboratory report; summative examination.",
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Introduction to Applied Biological Sciences",
        subTopics: ["Definition and scope of biological sciences relevant to nutrition", "Branches of biology: botany, zoology, microbiology, genetics, ecology", "Scientific method: observation, hypothesis, experiment, conclusion", "Biological science in nutrition: why it matters", "Overview of life: characteristics of living organisms"],
        hours: 3, specificLearningOutcomes: "Define biological sciences; describe branches relevant to nutrition; explain scientific method.",
        learningActivities: "Lecture, group discussions.", resourcesAndReferences: "Biology textbooks; charts.", assessmentAndRemarks: "Class quiz."
      },
      {
        weekNumber: 2,
        topicTitle: "Cell Biology — Structure and Function",
        subTopics: ["Cell theory: all living things are composed of cells", "Plant cells vs. animal cells: structural differences", "Cell organelles and their functions: nucleus, mitochondria, ribosomes, endoplasmic reticulum, Golgi apparatus, lysosomes", "Cell membrane: structure (phospholipid bilayer), selective permeability", "Cell transport: diffusion, osmosis, active transport, endocytosis, exocytosis"],
        hours: 3, specificLearningOutcomes: "Describe cell structure; distinguish plant and animal cells; explain organelle functions; describe cell transport mechanisms.",
        learningActivities: "Lecture, practical microscope cell observation.", resourcesAndReferences: "Microscopes; biology textbooks; diagrams.", assessmentAndRemarks: "Practical cell observation, oral questions."
      },
      {
        weekNumber: 3,
        topicTitle: "Cell Division and Growth",
        subTopics: ["Mitosis: stages (prophase, metaphase, anaphase, telophase), significance in growth and repair", "Meiosis: stages, significance in sexual reproduction and genetic variation", "Cell cycle regulation and cancer: relevance to nutrition", "Stem cells: types and nutritional support for tissue repair"],
        hours: 3, specificLearningOutcomes: "Describe mitosis and meiosis; explain cell cycle regulation; describe stem cells and nutritional relevance.",
        learningActivities: "Lecture, diagram exercises.", resourcesAndReferences: "Biology textbooks; mitosis/meiosis diagrams.", assessmentAndRemarks: "Diagram exercise, oral questions."
      },
      {
        weekNumber: 4,
        topicTitle: "Genetics and Heredity",
        subTopics: ["DNA structure: double helix, nucleotides, base pairing", "DNA replication: semi-conservative model", "Genes and chromosomes: structure, karyotype", "Mendelian genetics: dominant and recessive traits, Punnett squares", "Gene expression: transcription and translation overview"],
        hours: 3, specificLearningOutcomes: "Describe DNA structure and replication; explain Mendelian genetics; describe gene expression.",
        learningActivities: "Lecture, Punnett square exercises.", resourcesAndReferences: "Biology textbooks; DNA models.", assessmentAndRemarks: "Genetics exercise, oral questions."
      },
      {
        weekNumber: 5,
        topicTitle: "Nutritional Genomics and Gene-Diet Interactions",
        subTopics: ["Introduction to nutrigenomics: gene-diet interactions", "Genetic polymorphisms and their nutritional implications: lactase persistence, MTHFR, FTO", "Epigenetics: influence of diet on gene expression", "Personalised nutrition: concept and applications", "Ethical considerations in nutritional genomics"],
        hours: 3, specificLearningOutcomes: "Explain nutrigenomics and gene-diet interactions; describe genetic polymorphisms with nutritional implications; explain epigenetics.",
        learningActivities: "Lecture, case studies on gene-diet interactions.", resourcesAndReferences: "Nutrigenomics textbooks; journal articles.", assessmentAndRemarks: "Case study analysis."
      },
      {
        weekNumber: 6,
        topicTitle: "Ecology and Food Systems",
        subTopics: ["Concepts of ecology: ecosystem, food chains, food webs, trophic levels", "Agroecosystems: structure, function, and sustainability", "Biodiversity and food diversity: wild foods and their nutritional value", "Environmental nutrition: planetary boundaries and sustainable diets", "Climate change and food systems: threats to food security and nutrition"],
        hours: 3, specificLearningOutcomes: "Describe ecosystem concepts; explain agroecosystems; link biodiversity to food diversity; explain environmental nutrition.",
        learningActivities: "Lecture, food web diagram exercise.", resourcesAndReferences: "Ecology textbooks; EAT-Lancet report.", assessmentAndRemarks: "Food web diagram, oral questions."
      },
      {
        weekNumber: 7,
        topicTitle: "Continuous Assessment Test (CAT) — Applied Biological Sciences",
        subTopics: ["Written theory assessment covering topics from Weeks 1–6", "Post-CAT review and feedback session"],
        hours: 3, specificLearningOutcomes: "Demonstrate mastery of topics from Weeks 1–6.",
        learningActivities: "Supervised written CAT, plenary review.", resourcesAndReferences: "Examination scripts; marking keys.", assessmentAndRemarks: "CAT."
      },
      {
        weekNumber: 8,
        topicTitle: "Evolutionary Biology and Human Nutrition",
        subTopics: ["Evolution of Homo sapiens and dietary adaptations", "Evolutionary origins of human dietary patterns: hunter-gatherer, agricultural, modern", "Evolutionary mismatch: obesity, type 2 diabetes, cardiovascular disease", "Gut microbiome evolution and modern dietary changes", "Palaeolithic diet debate: evidence and limitations"],
        hours: 3, specificLearningOutcomes: "Describe human dietary evolution; explain evolutionary mismatch; describe gut microbiome evolution.",
        learningActivities: "Lecture, case discussions.", resourcesAndReferences: "Evolutionary nutrition textbooks; journal articles.", assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 9,
        topicTitle: "Botany and Plant Foods",
        subTopics: ["Plant cell structure: cell wall, chloroplasts, vacuoles", "Photosynthesis: light and dark reactions, nutritional significance", "Plant classification: monocots and dicots, edible plant parts", "Phytochemicals: flavonoids, carotenoids, glucosinolates — antioxidant and anti-inflammatory roles", "Traditional food plants in Kenya and their nutritional value"],
        hours: 3, specificLearningOutcomes: "Describe plant cell structure; explain photosynthesis; identify phytochemicals and their health roles.",
        learningActivities: "Lecture, plant cell microscope practical.", resourcesAndReferences: "Botany textbooks; local plant food samples.", assessmentAndRemarks: "Practical exercise, oral questions."
      },
      {
        weekNumber: 10,
        topicTitle: "Zoology and Animal Foods",
        subTopics: ["Classification of food animals: mammals, birds, fish, crustaceans, molluscs", "Animal nutrition and product quality: effect of animal diet on meat, milk, egg quality", "Anatomy and physiology of digestion in ruminants, monogastrics, poultry", "Animal products in human nutrition: meat, eggs, milk, fish — nutritional contributions", "Ethical and environmental considerations in animal food production"],
        hours: 3, specificLearningOutcomes: "Classify food animals; describe effect of animal diet on product quality; explain nutritional contributions of animal foods.",
        learningActivities: "Lecture, case discussions.", resourcesAndReferences: "Zoology and animal science textbooks.", assessmentAndRemarks: "Oral questions, assignment."
      },
      {
        weekNumber: 11,
        topicTitle: "Microbiology and Nutrition — Gut Microbiome",
        subTopics: ["Introduction to the gut microbiome: composition, diversity, functions", "Role of gut microbiome in nutrient absorption: short-chain fatty acids, B-vitamin synthesis, vitamin K", "Diet and gut microbiome: dietary fibre, prebiotics, probiotics", "Gut dysbiosis and disease: obesity, inflammatory bowel disease, malnutrition", "Modulating the gut microbiome through diet"],
        hours: 3, specificLearningOutcomes: "Describe the gut microbiome and its functions; explain diet-microbiome interactions; describe prebiotics and probiotics.",
        learningActivities: "Lecture, case studies on gut health and diet.", resourcesAndReferences: "Gut microbiome textbooks; journal articles.", assessmentAndRemarks: "Case study analysis."
      },
      {
        weekNumber: 12,
        topicTitle: "Laboratory Practicals in Applied Biological Sciences",
        subTopics: ["Microscope practical: observing plant cells (onion/potato) and animal cells (cheek cells)", "Osmosis experiment: potato cylinders in saline and distilled water", "Photosynthesis experiment: observing oxygen production in water plants", "DNA extraction practical: extracting DNA from strawberries or bananas", "Fermentation experiment: yeast and sugar fermentation"],
        hours: 3, specificLearningOutcomes: "Carry out biological science laboratory practicals; record and interpret results.",
        learningActivities: "Laboratory practicals.", resourcesAndReferences: "Laboratory reagents; microscopes; biological samples.", assessmentAndRemarks: "Laboratory report."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in Applied Biological Sciences",
        subTopics: ["Emerging issues: CRISPR and gene editing in food production", "Genetically modified organisms (GMOs): safety, regulation, nutritional implications in Kenya", "Stem cell technology and lab-grown meat", "Synthetic biology and novel food proteins", "Emerging challenges and coping strategies"],
        hours: 3, specificLearningOutcomes: "Discuss emerging biological science issues; describe GMOs in food context; explain CRISPR.",
        learningActivities: "Discussions, presentations.", resourcesAndReferences: "Journal articles; biosafety resources.", assessmentAndRemarks: "Oral presentation."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Applied Biological Sciences",
        subTopics: ["Comprehensive written theory examination", "Practical: laboratory biology practical"],
        hours: 3, specificLearningOutcomes: "Demonstrate comprehensive mastery of applied biological sciences.",
        learningActivities: "Supervised theory and practical examination.", resourcesAndReferences: "Official examination papers; marking rubrics.", assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Campbell, N. A., & Reece, J. B. (2011). Biology (9th ed.). Benjamin Cummings.",
      "Mozaffarian, D. (2016). Dietary and Policy Priorities for Cardiovascular Disease, Diabetes, and Obesity. Circulation.",
      "Sender, R., Fuchs, S., & Milo, R. (2016). Revised Estimates for the Number of Human and Bacteria Cells in the Body. Cell."
    ],
    instructionalEquipment: [
      "Microscopes", "Laboratory reagents and equipment",
      "Biological specimens", "DNA extraction materials",
      "Whiteboard and LCD projector"
    ]
  },

  "food_science": {
    canonicalKey: "food_science",
    syllabusCode: "CHN 1202",
    unitCode: "CHN 1202",
    unitName: "Food Science",
    moduleNumber: 1,
    nominalHours: 40,
    theoryHours: 24,
    practicalHours: 16,
    aliases: ["CHN 1202", "CND 2106", "Food Science"],
    isAvailable: true,
    unitDescription: "This unit equips the trainee with knowledge of food science principles relevant to understanding food composition, properties, and processing in nutrition practice.",
    overallCompetency: "By the end of the unit, the trainee should be able to: describe the chemical composition of foods; explain functional properties of food components; describe water activity and its effects on food quality; apply food science principles in food preparation and preservation; evaluate food quality and sensory characteristics.",
    learningOutcomes: [
      "Describe the chemical composition and nutritional value of foods",
      "Explain functional properties of carbohydrates, proteins, fats, and water",
      "Describe water activity and its effects on food quality and safety",
      "Apply food science principles in food preparation and processing",
      "Evaluate food quality using sensory assessment",
      "Describe food quality standards and labelling requirements"
    ],
    teachingLearningApproaches: "Lectures, food science laboratory practicals, food preparation demonstrations, sensory evaluation sessions.",
    assessmentApproaches: "Continuous Assessment Test (CAT); laboratory report; summative examination.",
    weeklySchedule: [
      {
        weekNumber: 1,
        topicTitle: "Introduction to Food Science",
        subTopics: ["Definition and scope of food science", "Branches of food science: food chemistry, food microbiology, food engineering, food safety, sensory evaluation", "Importance of food science in nutrition practice", "Food science laboratory: safety, equipment, and procedures", "Overview of food composition: macronutrients, micronutrients, water, phytochemicals"],
        hours: 3, specificLearningOutcomes: "Define food science; describe branches; explain importance in nutrition; identify laboratory equipment.",
        learningActivities: "Lecture, food science laboratory introduction.", resourcesAndReferences: "Food science textbooks; laboratory equipment.", assessmentAndRemarks: "Class quiz."
      },
      {
        weekNumber: 2,
        topicTitle: "Water in Food: Properties and Water Activity",
        subTopics: ["Physical and chemical properties of water: polarity, hydrogen bonding", "Water activity (aw): definition, measurement, and significance", "Effect of water activity on food safety: microbial growth and spoilage", "Free vs. bound water in foods", "Methods of controlling water activity: drying, salting, sugaring, freezing"],
        hours: 3, specificLearningOutcomes: "Describe water properties; define water activity; explain effect of aw on microbial growth; describe water activity control methods.",
        learningActivities: "Lecture, practical determination of water content in foods.", resourcesAndReferences: "Food science textbooks; desiccating oven.", assessmentAndRemarks: "Practical exercise."
      },
      {
        weekNumber: 3,
        topicTitle: "Carbohydrates in Food",
        subTopics: ["Classification and structure of food carbohydrates: sugars, starch, dietary fibre", "Functional properties: sweetness, viscosity, gel formation, foam stability", "Starch gelatinization and retrogradation", "Dietary fibre: soluble and insoluble, health effects", "Sugar: crystallization, caramelization, Maillard browning"],
        hours: 3, specificLearningOutcomes: "Describe food carbohydrate structures; explain functional properties; describe starch gelatinization and fibre health effects.",
        learningActivities: "Lecture, practical: starch gelatinization experiment.", resourcesAndReferences: "Food chemistry textbooks; starch samples.", assessmentAndRemarks: "Practical exercise, report."
      },
      {
        weekNumber: 4,
        topicTitle: "Proteins in Food",
        subTopics: ["Structure and classification of food proteins: complete and incomplete proteins", "Functional properties of proteins: gelation, emulsification, foaming, water binding, coagulation", "Denaturation of proteins: heat, acid, mechanical stress — implications in cooking", "Protein-protein interactions: gluten formation in wheat", "Protein quality: biological value, amino acid score, PDCAAS"],
        hours: 3, specificLearningOutcomes: "Describe protein structure and functional properties; explain denaturation; describe protein quality measures.",
        learningActivities: "Lecture, practical: protein denaturation experiment (egg white).", resourcesAndReferences: "Food chemistry textbooks; food samples.", assessmentAndRemarks: "Practical exercise, report."
      },
      {
        weekNumber: 5,
        topicTitle: "Lipids in Food",
        subTopics: ["Classification and structure of food lipids: triglycerides, phospholipids, sterols", "Physical properties: melting point, plasticity, polymorphism in chocolate and fats", "Functional properties: emulsification, shortening, flavour, fat replacers", "Oxidative rancidity: causes, prevention, antioxidants", "Trans fats: formation by hydrogenation and health implications"],
        hours: 3, specificLearningOutcomes: "Classify food lipids; describe functional properties; explain rancidity and antioxidants; describe trans fat formation.",
        learningActivities: "Lecture, practical: rancidity testing of oils.", resourcesAndReferences: "Food chemistry textbooks; oil samples.", assessmentAndRemarks: "Practical exercise, report."
      },
      {
        weekNumber: 6,
        topicTitle: "Vitamins and Minerals in Food Processing",
        subTopics: ["Stability of vitamins during processing: heat-labile (Vitamin C, B1) vs. heat-stable (B12)", "Effect of processing on mineral bioavailability: phytates, oxalates, iron absorption", "Vitamin C retention during cooking and storage", "Fortification vs. enrichment of foods", "Mineral-mineral interactions: iron and zinc competition"],
        hours: 3, specificLearningOutcomes: "Describe vitamin stability during processing; explain mineral bioavailability; distinguish fortification and enrichment.",
        learningActivities: "Lecture, vitamin C retention experiment.", resourcesAndReferences: "Food chemistry textbooks; DCPIP reagent.", assessmentAndRemarks: "Practical exercise, report."
      },
      {
        weekNumber: 7,
        topicTitle: "Continuous Assessment Test (CAT) — Food Science",
        subTopics: ["Written theory assessment covering topics from Weeks 1–6", "Post-CAT review and feedback session"],
        hours: 3, specificLearningOutcomes: "Demonstrate mastery of food science topics from Weeks 1–6.",
        learningActivities: "Supervised written CAT, plenary review.", resourcesAndReferences: "Examination scripts; marking keys.", assessmentAndRemarks: "CAT."
      },
      {
        weekNumber: 8,
        topicTitle: "Food Colours, Flavours, and Additives",
        subTopics: ["Natural pigments in foods: chlorophyll, carotenoids, anthocyanins, betalains", "Changes in pigment during processing: colour degradation", "Flavour compounds: volatile and non-volatile, Maillard reaction products", "Food additives: preservatives, antioxidants, emulsifiers, thickeners, colourings", "Regulations on food additives: KEBS standards, FAO/WHO Codex"],
        hours: 3, specificLearningOutcomes: "Describe food pigments; explain flavour compounds; describe food additive types and regulations.",
        learningActivities: "Lecture, food colour extraction practical.", resourcesAndReferences: "Food science textbooks; food samples.", assessmentAndRemarks: "Practical exercise."
      },
      {
        weekNumber: 9,
        topicTitle: "Food Texture and Rheology",
        subTopics: ["Definition of food texture: hardness, cohesiveness, springiness, gumminess, chewiness", "Rheological properties of foods: viscosity, elasticity, plasticity", "Texture measurement: texture profile analysis (TPA)", "Texture modification in therapeutic diets: texture-modified foods for dysphagia", "Gel formation in food: gelatin, pectin, agar, starch gels"],
        hours: 3, specificLearningOutcomes: "Define food texture properties; describe rheological properties; describe gel formation and texture modification for therapeutic diets.",
        learningActivities: "Lecture, practical: gel formation experiment.", resourcesAndReferences: "Food science textbooks; gelatin; pectin; agar.", assessmentAndRemarks: "Practical exercise."
      },
      {
        weekNumber: 10,
        topicTitle: "Heat Transfer and Food Preparation",
        subTopics: ["Methods of heat transfer: conduction, convection, radiation", "Heat transfer in cooking: boiling, steaming, baking, frying, grilling, roasting", "Effect of cooking on nutritional content: advantages and losses", "Cooking and antinutritional factors: phytates, oxalates, lectins, tannins", "Optimal cooking methods for nutrient retention"],
        hours: 3, specificLearningOutcomes: "Describe heat transfer methods in cooking; explain effects of cooking on nutritional content; describe antinutritional factor reduction.",
        learningActivities: "Lecture, practical: comparative cooking nutrient retention.", resourcesAndReferences: "Food science textbooks; cooking equipment.", assessmentAndRemarks: "Practical exercise, report."
      },
      {
        weekNumber: 11,
        topicTitle: "Sensory Evaluation of Food",
        subTopics: ["Importance of sensory evaluation in food science and nutrition", "Human senses in food evaluation: taste, smell, appearance, texture, sound", "Types of sensory tests: discrimination tests, descriptive analysis, affective tests", "Sensory evaluation panel: recruitment, training, conditions", "Practical: sensory evaluation of food samples"],
        hours: 3, specificLearningOutcomes: "Describe sensory evaluation methods; conduct sensory evaluation; interpret sensory data.",
        learningActivities: "Lecture, practical sensory evaluation exercise.", resourcesAndReferences: "Sensory evaluation score sheets; food samples; textbooks.", assessmentAndRemarks: "Sensory evaluation practical report."
      },
      {
        weekNumber: 12,
        topicTitle: "Food Quality, Standards, and Labelling",
        subTopics: ["Food quality parameters: safety, nutritional quality, sensory quality, authenticity", "Food quality standards in Kenya: KEBS food standards", "Codex Alimentarius standards: purpose and application", "Food labelling requirements: ingredients, nutrition facts, claims", "Reading and interpreting food labels for nutrition counselling"],
        hours: 3, specificLearningOutcomes: "Define food quality; describe KEBS and Codex standards; read and interpret food labels.",
        learningActivities: "Lecture, food label analysis exercise.", resourcesAndReferences: "KEBS food standards; food label samples; textbooks.", assessmentAndRemarks: "Food label analysis exercise."
      },
      {
        weekNumber: 13,
        topicTitle: "Emerging Issues and Trends in Food Science",
        subTopics: ["Emerging issues: novel foods, food biofortification, nanotechnology in food", "Functional foods and nutraceuticals: definition, examples, health claims", "3D food printing: technology and nutritional applications", "Clean label movement: consumer demands for natural ingredients", "Challenges and coping strategies"],
        hours: 3, specificLearningOutcomes: "Discuss emerging food science issues; describe functional foods; explain clean label movement.",
        learningActivities: "Discussions, presentations.", resourcesAndReferences: "Journal articles; industry reports.", assessmentAndRemarks: "Oral presentation."
      },
      {
        weekNumber: 14,
        topicTitle: "Final Summative Examination — Food Science",
        subTopics: ["Comprehensive written theory examination", "Practical: food science laboratory practical"],
        hours: 3, specificLearningOutcomes: "Demonstrate comprehensive mastery of food science principles.",
        learningActivities: "Supervised theory and practical examination.", resourcesAndReferences: "Official examination papers; marking rubrics.", assessmentAndRemarks: "Final summative examination."
      }
    ],
    references: [
      "Belitz, H. D., Grosch, W., & Schieberle, P. (2009). Food Chemistry (4th ed.). Springer.",
      "Vaclavik, V. A., & Christian, E. W. (2014). Essentials of Food Science (4th ed.). Springer.",
      "Kenya Bureau of Standards. Food Standards and Specifications."
    ],
    instructionalEquipment: [
      "Food science laboratory equipment (ovens, balances, pH meters)",
      "Food samples for analysis", "Sensory evaluation score sheets",
      "Reagents (Benedict's, Biuret, DCPIP)", "Whiteboard and LCD projector"
    ]
  }
};
