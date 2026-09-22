import ExcelJS from 'exceljs';
import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  deploymentEnvironmentLabel,
  deploymentStatusLabel,
  formatProductionTime,
  incidentSeverityLabel,
  incidentStatusLabel,
} from '@/features/production-controls/domain';
import {
  getProductionIncidents,
  getReleaseDeployments,
} from '@/features/production-controls/queries';
import {
  releaseDefectSeverityLabel,
  releaseDefectStatusLabel,
  releaseGoLiveLabel,
} from '@/features/system-testing/release-controls-domain';
import {
  getReleaseDefects,
  getReleaseGoLiveStatus,
  getReleaseSignoffs,
} from '@/features/system-testing/release-controls-queries';
import {
  formatTestingDateTime,
  releaseOutcomeLabel,
} from '@/features/system-testing/release-domain';
import {
  getReleaseReadiness,
  getReleaseTestRuns,
} from '@/features/system-testing/release-queries';

function styleHeader(
  row: ExcelJS.Row,
) {
  row.font = {
    bold: true,
    color: {
      argb: 'FFFFFFFF',
    },
  };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: {
      argb: 'FF18335C',
    },
  };
  row.alignment = {
    vertical: 'middle',
    wrapText: true,
  };
}

function finishSheet(
  sheet: ExcelJS.Worksheet,
) {
  sheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ];

  sheet.eachRow((row, index) => {
    row.alignment = {
      vertical: 'top',
      wrapText: true,
    };

    if (
      index > 1 &&
      index % 2 === 0
    ) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: 'FFF8FAFC',
        },
      };
    }
  });
}

export async function GET() {
  await requireHodAccess();

  const [
    readiness,
    runs,
    defects,
    goLive,
    signoffs,
    deployments,
    incidents,
  ] = await Promise.all([
    getReleaseReadiness(),
    getReleaseTestRuns(50),
    getReleaseDefects(500),
    getReleaseGoLiveStatus(),
    getReleaseSignoffs(100),
    getReleaseDeployments(200),
    getProductionIncidents(500),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Planning System';
  workbook.created = new Date();
  workbook.modified = new Date();

  const summary = workbook.addWorksheet('Release Summary');
  summary.columns = [
    {
      header: 'Control',
      width: 32,
    },
    {
      header: 'State',
      width: 54,
    },
  ];
  styleHeader(summary.getRow(1));
  summary.addRows([
    ['Generated', formatTestingDateTime(new Date().toISOString())],
    ['Automated readiness', readiness.ready ? 'Clear' : 'Blocked'],
    ['Automated blockers', readiness.blockerCount],
    ['Automated warnings', readiness.warningCount],
    ['Go-live state', releaseGoLiveLabel(goLive)],
    ['Go-live blocker defects', goLive.blockerDefects],
    ['Go-live warning defects', goLive.warningDefects],
    ['Active sign-off', goLive.activeSignoff?.verificationRef ?? 'None'],
    ['Latest Passed UAT', goLive.latestPassedRun?.suiteVersion ?? 'None'],
    ['Deployment records', deployments.length],
    ['Operational incidents', incidents.length],
  ]);
  finishSheet(summary);

  const readinessSheet = workbook.addWorksheet('Automated Readiness');
  readinessSheet.columns = [
    { header: 'Area', width: 22 },
    { header: 'Check', width: 34 },
    { header: 'Status', width: 14 },
    { header: 'Detail', width: 64 },
  ];
  styleHeader(readinessSheet.getRow(1));
  for (const check of readiness.checks) {
    readinessSheet.addRow([
      check.area,
      check.title,
      check.status,
      check.detail,
    ]);
  }
  finishSheet(readinessSheet);
  readinessSheet.autoFilter = { from: 'A1', to: 'D1' };

  const runSheet = workbook.addWorksheet('UAT Runs');
  runSheet.columns = [
    { header: 'Suite', width: 16 },
    { header: 'Academic Period', width: 26 },
    { header: 'Status', width: 15 },
    { header: 'Outcome', width: 15 },
    { header: 'Started', width: 24 },
    { header: 'Completed', width: 24 },
    { header: 'Start Blockers', width: 16 },
    { header: 'Completion Blockers', width: 20 },
    { header: 'Notes', width: 48 },
  ];
  styleHeader(runSheet.getRow(1));
  for (const run of runs) {
    runSheet.addRow([
      run.suiteVersion,
      run.academicPeriodName ?? '',
      run.status,
      releaseOutcomeLabel(run.outcome),
      formatTestingDateTime(run.startedAt),
      formatTestingDateTime(run.completedAt),
      run.startReadiness.blockerCount,
      run.completionReadiness?.blockerCount ?? '',
      run.notes ?? '',
    ]);
  }
  finishSheet(runSheet);
  runSheet.autoFilter = { from: 'A1', to: 'I1' };

  const defectSheet = workbook.addWorksheet('Release Defects');
  defectSheet.columns = [
    { header: 'Defect', width: 14 },
    { header: 'Severity', width: 14 },
    { header: 'Status', width: 16 },
    { header: 'Case', width: 18 },
    { header: 'Title', width: 38 },
    { header: 'Description', width: 58 },
    { header: 'Resolution', width: 58 },
    { header: 'Updated', width: 24 },
  ];
  styleHeader(defectSheet.getRow(1));
  for (const defect of defects) {
    defectSheet.addRow([
      `DEF-${defect.defectNumber}`,
      releaseDefectSeverityLabel(defect.severity),
      releaseDefectStatusLabel(defect.status),
      defect.caseKey ?? '',
      defect.title,
      defect.description,
      defect.resolutionNote ?? '',
      formatTestingDateTime(defect.updatedAt),
    ]);
  }
  finishSheet(defectSheet);
  defectSheet.autoFilter = { from: 'A1', to: 'H1' };

  const signoffSheet = workbook.addWorksheet('Sign-offs');
  signoffSheet.columns = [
    { header: 'Suite', width: 16 },
    { header: 'Status', width: 14 },
    { header: 'Verification ID', width: 34 },
    { header: 'Approved', width: 24 },
    { header: 'Revoked', width: 24 },
    { header: 'Note', width: 48 },
    { header: 'Revoke Reason', width: 48 },
  ];
  styleHeader(signoffSheet.getRow(1));
  for (const signoff of signoffs) {
    signoffSheet.addRow([
      signoff.suiteVersion,
      signoff.status,
      signoff.verificationRef,
      formatTestingDateTime(signoff.approvedAt),
      formatTestingDateTime(signoff.revokedAt),
      signoff.note ?? '',
      signoff.revokeReason ?? '',
    ]);
  }
  finishSheet(signoffSheet);
  signoffSheet.autoFilter = { from: 'A1', to: 'G1' };

  const deploymentSheet = workbook.addWorksheet('Deployments');
  deploymentSheet.columns = [
    { header: 'Environment', width: 16 },
    { header: 'Version', width: 26 },
    { header: 'Status', width: 16 },
    { header: 'Suite', width: 16 },
    { header: 'Verification ID', width: 34 },
    { header: 'Deployed By', width: 26 },
    { header: 'Deployed At', width: 24 },
    { header: 'Note', width: 48 },
    { header: 'Rollback Reason', width: 48 },
  ];
  styleHeader(deploymentSheet.getRow(1));
  for (const deployment of deployments) {
    deploymentSheet.addRow([
      deploymentEnvironmentLabel(deployment.environment),
      deployment.versionLabel,
      deploymentStatusLabel(deployment.status),
      deployment.suiteVersion,
      deployment.verificationRef ?? '',
      deployment.deployedByName ?? '',
      formatProductionTime(deployment.deployedAt),
      deployment.note ?? '',
      deployment.rollbackReason ?? '',
    ]);
  }
  finishSheet(deploymentSheet);
  deploymentSheet.autoFilter = { from: 'A1', to: 'I1' };

  const incidentSheet = workbook.addWorksheet('Operational Incidents');
  incidentSheet.columns = [
    { header: 'Incident', width: 14 },
    { header: 'Environment', width: 16 },
    { header: 'Deployment', width: 24 },
    { header: 'Severity', width: 14 },
    { header: 'Status', width: 16 },
    { header: 'Title', width: 38 },
    { header: 'Description', width: 58 },
    { header: 'Resolution', width: 58 },
    { header: 'Updated', width: 24 },
  ];
  styleHeader(incidentSheet.getRow(1));
  for (const incident of incidents) {
    incidentSheet.addRow([
      `INC-${incident.incidentNumber}`,
      deploymentEnvironmentLabel(incident.environment),
      incident.deploymentVersionLabel ?? '',
      incidentSeverityLabel(incident.severity),
      incidentStatusLabel(incident.status),
      incident.title,
      incident.description,
      incident.resolutionNote ?? '',
      formatProductionTime(incident.updatedAt),
    ]);
  }
  finishSheet(incidentSheet);
  incidentSheet.autoFilter = { from: 'A1', to: 'I1' };

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(
    new Uint8Array(buffer),
    {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Academic-Planner-Release-Evidence.xlsx"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
