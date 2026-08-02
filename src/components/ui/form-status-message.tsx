import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
} from 'lucide-react';

import { Alert } from './alert';

type FormStatus =
  | 'success'
  | 'error'
  | 'warning'
  | 'info';

interface FormStatusMessageProps {
  status: FormStatus;
  message: string;
  title?: string;
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
} as const;

const variants = {
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info',
} as const;

export function FormStatusMessage({
  status,
  message,
  title,
}: FormStatusMessageProps) {
  return (
    <Alert
      variant={variants[status]}
      icon={icons[status]}
      title={title}
    >
      {message}
    </Alert>
  );
}