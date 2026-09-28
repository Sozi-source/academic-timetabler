import { parseCourseOutlineSubtopics } from '../features/teaching-documents/tvet-standards';

const sample1 = ["1 · 1-2 · • Meaning of terms · • Overview of metabolism"];
const sample1_split = ["1", "1-2", "• Meaning of terms", "• Overview of metabolism"];
const sampleW10 = ["3 · 19-20 · • Meaning of terms • Types and classification · • Functions in the body"];
const sampleW13 = ["3 · 25-26 · • Characteristics of enzymes · • Factors influencing enzyme activity • 4 · 27-30 · Comprehensive coverage"];

console.log('Sample 1 raw:', parseCourseOutlineSubtopics(sample1));
console.log('Sample 1 split:', parseCourseOutlineSubtopics(sample1_split));
console.log('Sample W10:', parseCourseOutlineSubtopics(sampleW10));
console.log('Sample W13:', parseCourseOutlineSubtopics(sampleW13));
