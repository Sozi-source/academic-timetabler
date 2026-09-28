import { Badge } from '@/components/ui/badge';

import type {
  AcademicPeriodStatus,
} from './types';

interface AcademicPeriodStatusBadgeProps {
  status: AcademicPeriodStatus;
}

const statusConfiguration = {
  planned: {
    label: 'Planned',
    variant: 'info',
  },
  active: {
    label: 'Active',
    variant: 'success',
  },
  closed: {
    label: 'Closed',
    variant: 'neutral',
  },
  archived: {
    label: 'Archived',
    variant: 'warning',
  },
} as const;

export function AcademicPeriodStatusBadge({
  status,
}: AcademicPeriodStatusBadgeProps) {
  const configuration =
    statusConfiguration[status];

  return (
    <Badge
      variant={configuration.variant}
      dot={status === 'active'}
    >
      {configuration.label}
    </Badge>
  );
}