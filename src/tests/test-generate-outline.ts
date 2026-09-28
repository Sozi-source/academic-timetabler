import { distributeTopicsAcrossWeeks } from '../features/teaching-documents/distribution-engine';
import { parseCourseOutlineSubtopics } from '../features/teaching-documents/tvet-standards';

const content = [
  {
    topic: "Introduction to Biochemistry",
    coverage: "1 · 1-2 · • Meaning of terms · • Overview of metabolism",
    sequence: 1,
    sourceWeek: 1
  },
  {
    topic: "Carbohydrate Metabolism",
    coverage: "1 · 3-4 · • Coenzymes · • Glycolysis",
    sequence: 2,
    sourceWeek: 2
  },
  {
    topic: "Carbohydrate Metabolism",
    coverage: "1 · 5-6 · • Krebs Cycle",
    sequence: 3,
    sourceWeek: 3
  },
  {
    topic: "Carbohydrate Metabolism",
    coverage: "1 · 7-8 · • Gluconeogenesis • Oxidative Phosphorylation",
    sequence: 4,
    sourceWeek: 4
  },
  {
    topic: "Protein Metabolism",
    coverage: "2 · 9-10 · • Definitions • Transamination",
    sequence: 5,
    sourceWeek: 5
  },
  {
    topic: "Protein Metabolism",
    coverage: "2 · 11-12 · • Oxidative deamination",
    sequence: 6,
    sourceWeek: 6
  },
  {
    topic: "Continuous Assessment Test (CAT)",
    coverage: "2 · 13-14 · Covers Weeks 1–6",
    sequence: 7,
    sourceWeek: 7
  },
  {
    topic: "Protein Metabolism",
    coverage: "2 · 15-16 · • Amino Acid Anabolism",
    sequence: 8,
    sourceWeek: 8
  },
  {
    topic: "Protein Metabolism",
    coverage: "3 · 17-18 · • Ornithine Cycle",
    sequence: 9,
    sourceWeek: 9
  },
  {
    topic: "Lipids",
    coverage: "3 · 19-20 · • Meaning of terms • Types and classification · • Functions in the body",
    sequence: 10,
    sourceWeek: 10
  },
  {
    topic: "Lipids",
    coverage: "3 · 21-22 · • Lipid hydrolysis · • Digestion, absorption, metabolism, and excretion",
    sequence: 11,
    sourceWeek: 11
  },
  {
    topic: "Energy Metabolism/Balance",
    coverage: "3 · 23-24 · • Meaning of terms • Energy values of foods · • Energy balance · • Dietary requirement calculations",
    sequence: 12,
    sourceWeek: 12
  },
  {
    topic: "Enzymes",
    coverage: "3 · 25-26 · • Characteristics of enzymes · • Factors influencing enzyme activity",
    sequence: 13,
    sourceWeek: 13
  },
  {
    topic: "End Term Examination",
    coverage: "4 · 27-30 · Comprehensive coverage",
    sequence: 14,
    sourceWeek: 14
  }
];

const mapped = content.map((row, idx) => ({
  weekNumber: row.sourceWeek || row.sequence || (idx + 1),
  topicTitle: row.topic || `Topic ${idx + 1}`,
  subTopics: row.coverage
    ? String(row.coverage).split(/\s*[·;]\s*/).filter(Boolean)
    : [row.topic],
}));

const milestones = {
  catWeek: 5,
  catRemarks: 'Continuous Assessment Test 1 (15 Marks)',
  examWeek: 14,
  examRemarks: 'Final Summative Examination (70 Marks)',
};

const distributed = distributeTopicsAcrossWeeks(mapped, 14, milestones);
console.log('Distributed count:', distributed.length);
distributed.forEach((d) => {
  console.log(`W${d.weekNumber}: ${d.topicTitle}`);
  console.log('  raw subTopics:', JSON.stringify(d.subTopics));
  console.log('  parsed subTopics:', JSON.stringify(parseCourseOutlineSubtopics(d.subTopics)));
});
