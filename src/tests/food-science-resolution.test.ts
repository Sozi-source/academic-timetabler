import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value.trim();
  }
}

import { getApprovedCurriculumForUnitCode } from '@/features/teaching-documents/curriculum-content/queries';
import { findCanonicalCurriculum } from '@/features/teaching-documents/curriculum-registry';

describe('Food Science and Diet Therapy Curriculum Resolution', () => {
  it('resolves authentic Food Science course outline for CHN 1202', async () => {
    const doc = await getApprovedCurriculumForUnitCode('CHN 1202', 'Food Science', 'course_outline');
    expect(doc.isAvailable).toBe(true);
    expect(doc.weeklySchedule).toBeDefined();
    expect(doc.weeklySchedule!.length).toBeGreaterThanOrEqual(11);
    expect(doc.weeklySchedule![0].topicTitle).toContain('Introduction to Food Science');
    expect(doc.weeklySchedule![1].topicTitle).toContain('Principles of Food Processing and Preservation');
  });

  it('resolves authentic Food Science course outline for CND 2106', async () => {
    const doc = await getApprovedCurriculumForUnitCode('CND 2106', 'Food Science', 'course_outline');
    expect(doc.isAvailable).toBe(true);
    expect(doc.weeklySchedule).toBeDefined();
    expect(doc.weeklySchedule!.length).toBeGreaterThanOrEqual(11);
    expect(doc.weeklySchedule![0].topicTitle).toContain('Introduction to Food Science');
  });

  it('resolves authentic Diet Therapy Theory for CHN 1301 without Food Science contamination', async () => {
    const doc = await getApprovedCurriculumForUnitCode('CHN 1301', 'Diet Therapy Theory', 'course_outline');
    expect(doc.isAvailable).toBe(true);
    expect(doc.weeklySchedule).toBeDefined();
    expect(doc.weeklySchedule![0].topicTitle).not.toContain('Food Science');
    expect(doc.weeklySchedule![0].topicTitle.toLowerCase()).toContain('diet');
  });

  it('canonical curriculum for food_science contains authentic department topics', () => {
    const canonical = findCanonicalCurriculum('CHN 1202', 'Food Science');
    expect(canonical).toBeDefined();
    expect(canonical?.weeklySchedule[0].topicTitle).toBe('Introduction to Food Science');
    expect(canonical?.weeklySchedule[1].topicTitle).toBe('Principles of Food Processing and Preservation');
    expect(canonical?.weeklySchedule[2].topicTitle).toBe('Thermal Processing');
  });
});
