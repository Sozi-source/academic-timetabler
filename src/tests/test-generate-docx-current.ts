import fs from 'node:fs';
import { generateTVETCourseOutline } from '../features/teaching-documents/tvet-standards';
import { buildTVETDocumentDocx } from '../features/teaching-documents/export-docx';

// Create a realistic curriculum mock matching DHN 2304 in DB
const curriculum = {
  unitCode: 'DHN 2304',
  unitName: 'Biochemistry II',
  unitDescription: 'Comprehensive study of intermediate metabolism, enzymology, carbohydrate, protein and lipid metabolism, bioenergetics, and metabolic regulation.',
  learningOutcomes: ['Demonstrate knowledge of biomolecular structures and enzymes.'],
  references: ['Lehninger Principles of Biochemistry, 8th Edition.'],
  instructionalEquipment: ['Whiteboard & markers'],
  weeklySchedule: [
    {
      weekNumber: 1,
      topicTitle: 'Introduction to Biochemistry',
      subTopics: ['1', '1-2', '• Meaning of terms', '• Overview of metabolism'],
    },
    {
      weekNumber: 2,
      topicTitle: 'Carbohydrate Metabolism',
      subTopics: ['1', '3-4', '• Coenzymes', '• Glycolysis'],
    },
    {
      weekNumber: 5,
      topicTitle: 'Continuous Assessment Test 1 (15 Marks)',
      subTopics: [],
    },
    {
      weekNumber: 10,
      topicTitle: 'Lipids',
      subTopics: ['3', '19-20', '• Meaning of terms • Types and classification', '• Functions in the body'],
    }
  ],
};

const header = {
  institutionName: 'INSTITUTION',
  departmentName: 'HUMAN NUTRITION AND DIETETICS',
  academicPeriodName: 'TERM 1 2026',
  unitCode: 'DHN 2304',
  unitName: 'Biochemistry II',
  cohortName: 'DHN 2026',
  trainerName: 'Trainer Name',
  totalNominalHours: 56,
  weeklyHours: 4,
};

async function test() {
  const outline = generateTVETCourseOutline(header, curriculum as any);
  console.log('Generating docx...');
  const buf = await buildTVETDocumentDocx('course_outline', { courseOutline: outline });
  fs.writeFileSync('test-output.docx', buf);
  console.log('Wrote test-output.docx, size:', buf.length);
}
test();
