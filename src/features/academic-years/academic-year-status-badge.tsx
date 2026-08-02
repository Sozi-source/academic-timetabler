import { Badge } from '@/components/ui/badge';

import type {
  AcademicYearStatus,
} from './types';

interface AcademicYearStatusBadgeProps {
  status: AcademicYearStatus;
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

export function AcademicYearStatusBadge({
  status,
}: AcademicYearStatusBadgeProps) {
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