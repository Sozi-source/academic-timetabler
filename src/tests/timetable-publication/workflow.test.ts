import { describe, expect, it } from 'vitest';

import { getAllowedTimetableTransitions } from '@/features/timetable-publication/workflow';

describe('timetable publication workflow', () => {
  it('uses the controlled enterprise lifecycle', () => {
    expect(getAllowedTimetableTransitions('draft')).toEqual(['under_review']);
    expect(getAllowedTimetableTransitions('under_review')).toEqual(['approved', 'draft']);
    expect(getAllowedTimetableTransitions('approved')).toEqual(['published', 'under_review']);
    expect(getAllowedTimetableTransitions('published')).toEqual(['archived']);
    expect(getAllowedTimetableTransitions('archived')).toEqual([]);
  });
});
