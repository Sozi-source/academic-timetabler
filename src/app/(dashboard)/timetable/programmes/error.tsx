'use client';

import {
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ProgrammesErrorProps {
  reset: () => void;
}

export default function ProgrammesError({
  reset,
}: ProgrammesErrorProps) {
  return (
    <Alert
      variant="danger"
      icon={AlertTriangle}
      title="Programmes could not be loaded"
      className="flex-col items-start px-6 py-6"
    >
      <p>
        Check the database connection and try
        loading the Programmes page again.
      </p>

      <Button
        variant="outline"
        className="mt-4"
        leadingIcon={
          <RefreshCw
            className="size-4"
            aria-hidden="true"
          />
        }
        onClick={reset}
      >
        Try again
      </Button>
    </Alert>
  );
}