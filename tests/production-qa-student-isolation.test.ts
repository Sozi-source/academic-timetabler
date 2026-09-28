import { describe, expect, it } from 'vitest';

interface MockStudentResult {
  id: string;
  studentId: string;
  unitCode: string;
  totalMark: number;
  grade: string;
  isPublished: boolean;
  publishedAt: string | null;
}

interface MockStudentDocument {
  id: string;
  unitCode: string;
  documentType: string;
  status: 'draft' | 'submitted' | 'approved';
  studentPublishedAt: string | null;
}

function filterStudentVisibleResults(
  studentId: string,
  results: MockStudentResult[]
): MockStudentResult[] {
  return results.filter(
    (r) => r.studentId === studentId && r.isPublished && r.publishedAt !== null
  );
}

function filterStudentVisibleDocuments(
  documents: MockStudentDocument[]
): MockStudentDocument[] {
  return documents.filter(
    (d) => d.status === 'approved' && d.studentPublishedAt !== null
  );
}

function isValidStudentPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

describe('Production QA: Student Isolation & Data Protection', () => {
  describe('Student PIN Authentication Format', () => {
    it('accepts only 6-digit numeric PINs', () => {
      expect(isValidStudentPin('123456')).toBe(true);
      expect(isValidStudentPin('000123')).toBe(true);
      expect(isValidStudentPin('12345')).toBe(false);
      expect(isValidStudentPin('1234567')).toBe(false);
      expect(isValidStudentPin('12345a')).toBe(false);
      expect(isValidStudentPin('abcdef')).toBe(false);
    });
  });

  describe('Published Results Isolation', () => {
    it('strictly hides unpublished, draft, and unfinalised marks from students', () => {
      const allResults: MockStudentResult[] = [
        {
          id: 'res-1',
          studentId: 'student-A',
          unitCode: 'NUTR 101',
          totalMark: 78,
          grade: 'A',
          isPublished: true,
          publishedAt: '2026-08-21T10:00:00Z',
        },
        {
          id: 'res-2',
          studentId: 'student-A',
          unitCode: 'NUTR 102',
          totalMark: 65,
          grade: 'B',
          isPublished: false, // Trainer entered, but HOD has not published
          publishedAt: null,
        },
        {
          id: 'res-3',
          studentId: 'student-B',
          unitCode: 'NUTR 101',
          totalMark: 82,
          grade: 'A',
          isPublished: true,
          publishedAt: '2026-08-21T10:00:00Z',
        },
      ];

      const visibleToStudentA = filterStudentVisibleResults('student-A', allResults);
      expect(visibleToStudentA).toHaveLength(1);
      expect(visibleToStudentA[0].unitCode).toBe('NUTR 101');
      expect(visibleToStudentA[0].studentId).toBe('student-A');
    });
  });

  describe('Approved Teaching Documents Isolation', () => {
    it('strictly hides draft and unapproved documents from students', () => {
      const allDocs: MockStudentDocument[] = [
        {
          id: 'doc-1',
          unitCode: 'NUTR 101',
          documentType: 'course_outline',
          status: 'approved',
          studentPublishedAt: '2026-08-20T10:00:00Z',
        },
        {
          id: 'doc-2',
          unitCode: 'NUTR 101',
          documentType: 'scheme_of_work',
          status: 'submitted', // HOD has not yet approved
          studentPublishedAt: null,
        },
        {
          id: 'doc-3',
          unitCode: 'NUTR 101',
          documentType: 'record_of_work',
          status: 'draft',
          studentPublishedAt: null,
        },
      ];

      const visibleDocs = filterStudentVisibleDocuments(allDocs);
      expect(visibleDocs).toHaveLength(1);
      expect(visibleDocs[0].documentType).toBe('course_outline');
      expect(visibleDocs[0].status).toBe('approved');
    });
  });
});
