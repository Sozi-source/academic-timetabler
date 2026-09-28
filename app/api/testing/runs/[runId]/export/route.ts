import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import {
  formatTestingDateTime,
  releaseCaseResultLabel,
  releaseOutcomeLabel,
  releaseRequirementLabel,
} from '@/features/system-testing/release-domain';
import { getReleaseTestRunWorkspace } from '@/features/system-testing/release-queries';

function fileSafe(value: string): string {
  const safe = value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return safe || 'release-test';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  await requireHodAccess();
  const { runId } = await params;
  const workspace = await getReleaseTestRunWorkspace(runId);

  if (!workspace) {
    return NextResponse.json(
      { message: 'Release test run was not found.' },
      { status: 404 },
    );
  }

  const { run, cases } = workspace;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Planning System';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 30 }, { width: 46 }];
  summary.addRows([
    ['Release Test Run', run.id],
    ['Department', run.departmentName],
    ['Academic Period', run.academicPeriodName ?? 'Not captured'],
    ['Suite Version', run.suiteVersion],
    ['Status', run.status],
    ['Outcome', releaseOutcomeLabel(run.outcome)],
    ['Started', formatTestingDateTime(run.startedAt)],
    ['Completed', formatTestingDateTime(run.completedAt)],
    ['Start Blockers', run.startReadiness.blockerCount],
    ['Start Warnings', run.startReadiness.warningCount],
    ['Completion Blockers', run.completionReadiness?.blockerCount ?? ''],
    ['Completion Warnings', run.completionReadiness?.warningCount ?? ''],
    ['Run Notes', run.notes ?? ''],
  ]);
  summary.getColumn(1).font = { bold: true };
  summary.getColumn(2).alignment = { vertical: 'top', wrapText: true };

  const casesSheet = workbook.addWorksheet('UAT Cases');
  casesSheet.columns = [
    { header: 'Case', key: 'case', width: 14 },
    { header: 'Area', key: 'area', width: 22 },
    { header: 'Requirement', key: 'requirement', width: 16 },
    { header: 'Test', key: 'title', width: 34 },
    { header: 'Expected Result', key: 'expected', width: 58 },
    { header: 'Result', key: 'result', width: 14 },
    { header: 'Evidence / Note', key: 'note', width: 48 },
    { header: 'Tested At', key: 'testedAt', width: 24 },
  ];

  for (const testCase of cases) {
    casesSheet.addRow({
      case: testCase.caseKey,
      area: testCase.area,
      requirement: releaseRequirementLabel(testCase.requirementLevel),
      title: testCase.title,
      expected: testCase.expectedResult,
      result: releaseCaseResultLabel(testCase.result),
      note: testCase.note ?? '',
      testedAt: formatTestingDateTime(testCase.testedAt),
    });
  }

  casesSheet.getRow(1).font = { bold: true };
  casesSheet.getRow(1).alignment = { vertical: 'middle' };
  casesSheet.views = [{ state: 'frozen', ySplit: 1 }];
  casesSheet.autoFilter = { from: 'A1', to: 'H1' };

  for (let row = 2; row <= casesSheet.rowCount; row += 1) {
    casesSheet.getRow(row).alignment = { vertical: 'top', wrapText: true };
  }

  const readiness = workbook.addWorksheet('Readiness');
  readiness.columns = [
    { header: 'Area', key: 'area', width: 22 },
    { header: 'Check', key: 'check', width: 34 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Detail', key: 'detail', width: 62 },
  ];

  const finalReadiness = run.completionReadiness ?? run.startReadiness;
  for (const check of finalReadiness.checks) {
    readiness.addRow({
      area: check.area,
      check: check.title,
      status: check.status,
      detail: check.detail,
    });
  }

  readiness.getRow(1).font = { bold: true };
  readiness.views = [{ state: 'frozen', ySplit: 1 }];
  readiness.autoFilter = { from: 'A1', to: 'D1' };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${fileSafe(run.departmentName)}-release-test-${run.suiteVersion}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
