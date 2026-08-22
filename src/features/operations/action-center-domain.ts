import type {
  OperationsReadiness,
} from './types';
import type {
  ReleaseDefect,
  ReleaseGoLiveStatus,
} from '@/features/system-testing/release-controls-types';
import type {
  ProductionIncident,
  ReleaseDeployment,
} from '@/features/production-controls/types';
import {
  incidentBlocksProduction,
} from '@/features/production-controls/domain';

export type ActionCenterSeverity =
  | 'critical'
  | 'warning'
  | 'info';

export interface ActionCenterItem {
  id: string;
  severity: ActionCenterSeverity;
  area: string;
  title: string;
  detail: string;
  href: string;
}

function releaseDefectOpen(
  defect: ReleaseDefect,
): boolean {
  return defect.status !== 'closed';
}

export function buildActionCenter({
  readiness,
  goLive,
  defects,
  deployments,
  incidents,
}: {
  readiness: OperationsReadiness;
  goLive: ReleaseGoLiveStatus;
  defects: ReleaseDefect[];
  deployments: ReleaseDeployment[];
  incidents: ProductionIncident[];
}): ActionCenterItem[] {
  const items: ActionCenterItem[] = [];

  if (readiness.students.accessMissing > 0) {
    items.push({
      id: 'student-access',
      severity: 'warning',
      area: 'Students',
      title: `${readiness.students.accessMissing} student access gap${readiness.students.accessMissing === 1 ? '' : 's'}`,
      detail: 'Issue or enable portal access for eligible students.',
      href: '/students/access',
    });
  }

  if (readiness.attendance.incomplete > 0) {
    items.push({
      id: 'attendance',
      severity: 'warning',
      area: 'Attendance',
      title: `${readiness.attendance.incomplete} incomplete attendance session${readiness.attendance.incomplete === 1 ? '' : 's'}`,
      detail: 'Review open class attendance before the operational period is closed.',
      href: '/operations/attendance',
    });
  }

  const documentActions =
    readiness.documents.awaitingReview +
    readiness.documents.returned;

  if (documentActions > 0) {
    items.push({
      id: 'documents',
      severity: 'warning',
      area: 'Documents',
      title: `${documentActions} teaching document action${documentActions === 1 ? '' : 's'}`,
      detail: 'Review submitted documents and returned corrections.',
      href: '/teaching-documents/review',
    });
  }

  if (readiness.assessments.finalisedUnpublished > 0) {
    items.push({
      id: 'results',
      severity: 'warning',
      area: 'Assessment',
      title: `${readiness.assessments.finalisedUnpublished} finalised result set${readiness.assessments.finalisedUnpublished === 1 ? '' : 's'} not published`,
      detail: 'Complete authorised result publication.',
      href: '/assessment/assessments',
    });
  }

  const blockerDefects = defects.filter(
    (defect) =>
      releaseDefectOpen(defect) &&
      (
        defect.severity === 'critical' ||
        defect.severity === 'high'
      ),
  );

  if (blockerDefects.length > 0) {
    items.push({
      id: 'release-defects',
      severity: 'critical',
      area: 'Release',
      title: `${blockerDefects.length} release blocker${blockerDefects.length === 1 ? '' : 's'}`,
      detail: 'Critical/High UAT defects must be closed before release approval.',
      href: '/testing/defects',
    });
  }

  const blockerIncidents = incidents.filter(incidentBlocksProduction);
  if (blockerIncidents.length > 0) {
    items.push({
      id: 'production-incidents',
      severity: 'critical',
      area: 'Operations',
      title: `${blockerIncidents.length} Critical/High operational incident${blockerIncidents.length === 1 ? '' : 's'}`,
      detail: 'Resolve deployment incidents before recording another Production release.',
      href: '/operations/incidents',
    });
  }

  if (!goLive.signoffValid) {
    items.push({
      id: 'release-signoff',
      severity: goLive.eligible ? 'warning' : 'critical',
      area: 'Release',
      title: goLive.eligible
        ? 'Release awaiting go-live sign-off'
        : 'Go-live gate is blocked',
      detail: goLive.reasons[0] ?? 'Complete release controls before Production deployment.',
      href: '/testing/sign-off',
    });
  }

  const productionActive = deployments.some(
    (deployment) =>
      deployment.environment === 'production' &&
      deployment.status === 'deployed',
  );

  if (
    goLive.signoffValid &&
    !productionActive
  ) {
    items.push({
      id: 'production-deployment',
      severity: 'info',
      area: 'Release',
      title: 'Approved release not recorded as Production deployed',
      detail: 'Record deployment evidence when the approved build is released.',
      href: '/testing/deployments',
    });
  }

  const rank: Record<ActionCenterSeverity, number> = {
    critical: 1,
    warning: 2,
    info: 3,
  };

  return items.sort(
    (left, right) =>
      rank[left.severity] -
      rank[right.severity],
  );
}

export function actionCenterCounts(
  items: ActionCenterItem[],
) {
  return {
    total: items.length,
    critical: items.filter((item) => item.severity === 'critical').length,
    warning: items.filter((item) => item.severity === 'warning').length,
    info: items.filter((item) => item.severity === 'info').length,
  };
}

export function actionCenterVariant(
  severity: ActionCenterSeverity,
): 'danger' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}
