import { describe, expect, it } from 'vitest';

import { adminNavItems, isNavItemActive } from '@/components/layout/admin-sidebar';

describe('Admin Portal Design Specification Verification', () => {
  it('defines all required sidebar navigation items from the design', () => {
    const labels = adminNavItems.map((item) => item.label);

    expect(labels).toEqual([
      'Dashboard',
      'Daily Operations',
      'Class Attendance',
      'Action Centre',
      'Academic Planning',
      'Unit Registration',
      'Quality Assurance',
      'Grading & Results',
      'Reports',
      'Staff & Trainers',
      'Student Registry',
      'Settings',
    ]);
  });

  it('binds the correct target paths for admin navigation items', () => {
    const navMap = new Map(adminNavItems.map((item) => [item.label, item.href]));

    expect(navMap.get('Dashboard')).toBe('/dashboard');
    expect(navMap.get('Daily Operations')).toBe('/operations');
    expect(navMap.get('Class Attendance')).toBe('/attendance-clinical/class-attendance');
    expect(navMap.get('Action Centre')).toBe('/operations/action-center');
    expect(navMap.get('Academic Planning')).toBe('/timetable');
    expect(navMap.get('Unit Registration')).toBe('/students/unit-registration');
    expect(navMap.get('Quality Assurance')).toBe('/teaching-documents');
    expect(navMap.get('Grading & Results')).toBe('/assessment');
    expect(navMap.get('Reports')).toBe('/timetable/reports');
    expect(navMap.get('Staff & Trainers')).toBe('/trainers');
    expect(navMap.get('Student Registry')).toBe('/students/registry');
    expect(navMap.get('Settings')).toBe('/timetable/organization');
  });

  it('correctly resolves active nav item without collisions on nested subpaths', () => {
    const allHrefs = adminNavItems.map((item) => item.href);

    // Exact matches
    expect(isNavItemActive('/dashboard', '/dashboard', allHrefs, true)).toBe(true);
    expect(isNavItemActive('/dashboard', '/operations', allHrefs)).toBe(false);

    // Sibling prefix disambiguation: /operations vs /operations/action-center
    expect(isNavItemActive('/operations', '/operations', allHrefs)).toBe(true);
    expect(isNavItemActive('/operations/daily-reports', '/operations', allHrefs)).toBe(true);
    expect(isNavItemActive('/operations/action-center', '/operations', allHrefs)).toBe(false);
    expect(isNavItemActive('/operations/action-center', '/operations/action-center', allHrefs)).toBe(true);

    // Sibling prefix disambiguation: /timetable vs /timetable/reports vs /timetable/organization
    expect(isNavItemActive('/timetable', '/timetable', allHrefs)).toBe(true);
    expect(isNavItemActive('/timetable/editor', '/timetable', allHrefs)).toBe(true);
    expect(isNavItemActive('/timetable/reports', '/timetable', allHrefs)).toBe(false);
    expect(isNavItemActive('/timetable/reports', '/timetable/reports', allHrefs)).toBe(true);
    expect(isNavItemActive('/timetable/organization', '/timetable', allHrefs)).toBe(false);
    expect(isNavItemActive('/timetable/organization', '/timetable/organization', allHrefs)).toBe(true);

    // Deep nested paths
    expect(isNavItemActive('/trainers/wilfred-osozi', '/trainers', allHrefs)).toBe(true);
    expect(isNavItemActive('/students/registry/import', '/students/registry', allHrefs)).toBe(true);
    expect(isNavItemActive('/attendance-clinical/class-attendance/analytics', '/attendance-clinical/class-attendance', allHrefs)).toBe(true);
  });
});

