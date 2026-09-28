import { describe, expect, it } from 'vitest';
import {
  parseCsvText,
  parsePastedText,
  resolveGoogleSheetCsvUrl,
} from '@/features/student-reporting-sync/parsers';
import { normalizeAdmissionKey } from '@/features/student-reporting-sync/reconciliation';

describe('Live Reporting Sync — Google Sheet URL Resolution', () => {
  it('converts standard edit spreadsheet URL to CSV export endpoint', () => {
    const url = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
    const resolved = resolveGoogleSheetCsvUrl(url);
    expect(resolved).toBe(
      'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=0',
    );
  });

  it('preserves specific sheet tab gid when present', () => {
    const url = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?gid=987654321';
    const resolved = resolveGoogleSheetCsvUrl(url);
    expect(resolved).toBe(
      'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=987654321',
    );
  });

  it('converts published web pubhtml URL to CSV output endpoint', () => {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRe41W7_1234567890abcdef/pubhtml';
    const resolved = resolveGoogleSheetCsvUrl(url);
    expect(resolved).toBe(
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRe41W7_1234567890abcdef/pub?output=csv&gid=0',
    );
  });

  it('throws descriptive error on invalid non-google URL', () => {
    expect(() => resolveGoogleSheetCsvUrl('https://example.com/sheet.xlsx')).toThrow(
      'Please enter a valid Google Sheets link',
    );
  });
});

describe('Live Reporting Sync — CSV & Text Parsing', () => {
  it('parses CSV with standard Admission Number header', () => {
    const csv = `Admission Number,Student Name,Date
CHN/S-4184/IC/24,Felicia Mukami,2026-09-01
CHN/S-4680/IC/24,Jemimah Narumu,2026-09-02`;

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].admissionNumber).toBe('CHN/S-4184/IC/24');
    expect(rows[0].reportedOn).toBe('2026-09-01');
    expect(rows[1].admissionNumber).toBe('CHN/S-4680/IC/24');
  });

  it('parses CSV with colloquial headers (Adm No, Reg No)', () => {
    const csv = `Adm No,Full Name,Report Date
DNDT/2026/001,John Doe,2026-09-05
DNDT/2026/002,Jane Smith,2026-09-06`;

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].admissionNumber).toBe('DNDT/2026/001');
    expect(rows[1].admissionNumber).toBe('DNDT/2026/002');
  });

  it('parses headerless CSV with slash admission numbers', () => {
    const csv = `CHN/S-4184/IC/24,Felicia Mukami
CHN/S-4680/IC/24,Jemimah Narumu`;

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].admissionNumber).toBe('CHN/S-4184/IC/24');
    expect(rows[1].admissionNumber).toBe('CHN/S-4680/IC/24');
  });

  it('parses pasted newline-delimited text', () => {
    const pasted = `
      CHN/S-4184/IC/24
      CHN/S-4680/IC/24
      DNDT/2026/001
    `;

    const rows = parsePastedText(pasted);
    expect(rows).toHaveLength(3);
    expect(rows[0].admissionNumber).toBe('CHN/S-4184/IC/24');
    expect(rows[1].admissionNumber).toBe('CHN/S-4680/IC/24');
    expect(rows[2].admissionNumber).toBe('DNDT/2026/001');
  });

  it('parses tab-delimited paste from Excel / Google Sheets', () => {
    const tabData = `1\tCHN/S-4184/IC/24\tFelicia Mukami\tReported\n2\tCHN/S-4680/IC/24\tJemimah Narumu\tReported`;

    const rows = parsePastedText(tabData);
    expect(rows).toHaveLength(2);
    expect(rows[0].admissionNumber).toBe('CHN/S-4184/IC/24');
    expect(rows[1].admissionNumber).toBe('CHN/S-4680/IC/24');
  });
});

describe('Live Reporting Sync — Key Normalization', () => {
  it('normalizes admission keys by capitalizing and removing whitespace', () => {
    expect(normalizeAdmissionKey('chn / s - 4184 / ic / 24')).toBe('CHN/S-4184/IC/24');
    expect(normalizeAdmissionKey(' dndt/2026/001 ')).toBe('DNDT/2026/001');
    expect(normalizeAdmissionKey('CHN/S-4184/IC/24')).toBe('CHN/S-4184/IC/24');
  });
});
