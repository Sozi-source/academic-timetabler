import { describe, expect, it } from 'vitest';

import { adminNavItems } from '@/components/layout/admin-sidebar';

describe('Admin Portal Design Specification Verification', () => {
  it('defines all 8 required sidebar navigation items from the design', () => {
    const labels = adminNavItems.map((item) => item.label);

    expect(labels).toEqual([
      'Dashboard',
      'Daily Operations',
      'Academic Planning',
      'Quality Assurance',
      'Grading & Results',
      'Reports',
      'Action Centre',
      'Settings',
    ]);
  });

  it('binds the correct target paths for admin navigation items', () => {
    const navMap = new Map(adminNavItems.map((item) => [item.label, item.href]));

    expect(navMap.get('Dashboard')).toBe('/dashboard');
    expect(navMap.get('Daily Operations')).toBe('/operations');
    expect(navMap.get('Academic Planning')).toBe('/timetable');
    expect(navMap.get('Quality Assurance')).toBe('/teaching-documents');
    expect(navMap.get('Grading & Results')).toBe('/assessment');
    expect(navMap.get('Reports')).toBe('/timetable/reports');
    expect(navMap.get('Action Centre')).toBe('/operations/action-center');
    expect(navMap.get('Settings')).toBe('/timetable/organization');
  });
});
