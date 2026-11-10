import { describe, expect, it } from 'vitest';
import { generateTVETSchemeOfWork } from '@/features/teaching-documents/tvet-standards';
import { getUnitCurriculum } from '@/features/teaching-documents/curriculum-registry';

describe('Record of Work - Scheme of Work Direct Synchronization Suite', () => {
  it('correctly maps Biochemistry II curriculum including Lipid Metabolism at Weeks 6 and 7', () => {
    const biochemHeader = {
      institutionName: 'Imperial College of Medical & Health Sciences',
      departmentName: 'Nutrition and Dietetics',
      academicPeriodName: 'September - December 2026',
      unitCode: 'DHN 2304',
      unitName: 'Biochemistry II',
      cohortName: 'DHN 2026',
      trainerName: 'Wilfred Osozi',
      totalNominalHours: 66,
      weeklyHours: 5,
    };

    const scheme = generateTVETSchemeOfWork(biochemHeader);

    expect(scheme.plannedWeeks).toHaveLength(14);

    // Week 1–3: Carbohydrate Metabolism
    expect(scheme.plannedWeeks[0].topic).toBe('Carbohydrate Metabolism');
    expect(scheme.plannedWeeks[0].subTopics).toContain('Glycolysis');

    expect(scheme.plannedWeeks[1].topic).toBe('Carbohydrate Metabolism');
    expect(scheme.plannedWeeks[1].subTopics).toContain('Krebs cycle');

    expect(scheme.plannedWeeks[2].topic).toBe('Carbohydrate Metabolism');
    expect(scheme.plannedWeeks[2].subTopics).toContain('oxidative phosphorylation');

    // Week 4–5: Protein Metabolism
    expect(scheme.plannedWeeks[3].topic).toBe('Protein Metabolism');
    expect(scheme.plannedWeeks[3].subTopics).toContain('Transamination');

    expect(scheme.plannedWeeks[4].topic).toBe('Protein Metabolism');
    expect(scheme.plannedWeeks[4].subTopics).toContain('Urea cycle');

    // Week 6–7: Lipid Metabolism (Must NOT be skipped!)
    expect(scheme.plannedWeeks[5].topic).toBe('Lipid Metabolism');
    expect(scheme.plannedWeeks[5].subTopics).toContain('Fatty acid activation');
    expect(scheme.plannedWeeks[5].subTopics).toContain('Beta-oxidation');
    expect(scheme.plannedWeeks[5].specificLearningOutcomes).toContain('beta-oxidation');

    expect(scheme.plannedWeeks[6].topic).toBe('Lipid Metabolism');
    expect(scheme.plannedWeeks[6].subTopics).toContain('Diseases associated with lipid metabolism');

    // Week 8: Continuous Assessment Test (CAT)
    expect(scheme.plannedWeeks[7].topic).toBe('Continuous Assessment Test (CAT)');

    // Week 9–10: Nucleic Acids and Nucleotides
    expect(scheme.plannedWeeks[8].topic).toBe('Nucleic Acids and Nucleotides');
    expect(scheme.plannedWeeks[8].subTopics).toContain('DNA');

    expect(scheme.plannedWeeks[9].topic).toBe('Nucleic Acids and Nucleotides');
    expect(scheme.plannedWeeks[9].subTopics).toContain('RNA');

    // Week 11–12: Enzymology
    expect(scheme.plannedWeeks[10].topic).toBe('Enzymology');
    expect(scheme.plannedWeeks[10].subTopics).toContain('Classification of enzymes');

    expect(scheme.plannedWeeks[11].topic).toBe('Enzymology');
    expect(scheme.plannedWeeks[11].subTopics).toContain('Factors affecting enzyme action');

    // Week 13: Emerging Issues and Trends
    expect(scheme.plannedWeeks[12].topic).toBe('Emerging Issues and Trends');

    // Week 14: Examination
    expect(scheme.plannedWeeks[13].topic).toMatch(/Examination|Exam/i);
  });

  it('guarantees specific learning outcomes on Scheme of Work are populated on Record of Work', () => {
    const biochemHeader = {
      institutionName: 'Imperial College of Medical & Health Sciences',
      departmentName: 'Nutrition and Dietetics',
      academicPeriodName: 'September - December 2026',
      unitCode: 'DHN 2304',
      unitName: 'Biochemistry II',
      cohortName: 'DHN 2026',
      trainerName: 'Wilfred Osozi',
      totalNominalHours: 66,
      weeklyHours: 5,
    };

    const scheme = generateTVETSchemeOfWork(biochemHeader);

    for (const week of scheme.plannedWeeks) {
      if (week.weekNumber === 8 || week.weekNumber === 14) {
        // Assessment weeks have specialized assessment notes
        expect(week.assessmentAndRemarks).toBeTruthy();
      } else {
        // Teaching weeks MUST have non-empty learning outcomes and subtopics
        expect(week.specificLearningOutcomes.trim().length).toBeGreaterThan(10);
        expect(week.subTopics.trim().length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
