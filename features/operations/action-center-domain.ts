import type {
  OperationsReadiness,
} from './types';
import type {
  ReleaseGoLiveStatus,
} from '@/features/system-testing/release-controls-types';
import type {
  ProductionIncident,
  ReleaseDeployment,
} from '@/features/production-controls/types';
import type {
  ReleaseDefect,
} from '@/features/system-testing/release-controls-types';
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

export function buildActionCenter({
  readiness,
  goLive: _goLive,
  defects: _defects,
  deployments: _deployments,
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

  const blockerIncidents = incidents.filter(incidentBlocksProduction);
  if (blockerIncidents.length > 0) {
    items.push({
      id: 'production-incidents',
      severity: 'critical',
      area: 'Operations',
      title: `${blockerIncidents.length} Critical/High operational incident${blockerIncidents.length === 1 ? '' : 's'}`,
      detail: 'Resolve operational incidents.',
      href: '/operations/incidents',
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
