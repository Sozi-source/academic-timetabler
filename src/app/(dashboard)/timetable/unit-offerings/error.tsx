'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface UnitOfferingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function UnitOfferingsError({
  error,
  reset,
}: UnitOfferingsErrorProps) {
  return (
    <Alert variant="danger" icon={AlertTriangle} title="Units on Offer could not be loaded">
      <p>{error.message}</p>
      <Button
        type="button"
        onClick={reset}
        variant="danger"
        className="mt-3"
        leadingIcon={<RefreshCw className="size-4" aria-hidden="true" />}
      >
        Try again
      </Button>
    </Alert>
  );
}
