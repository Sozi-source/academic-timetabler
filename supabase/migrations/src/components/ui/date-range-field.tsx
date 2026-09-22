import { FormField } from './form-field';
import { Input } from './input';

interface DateRangeFieldProps {
  startId: string;
  endId: string;
  startName: string;
  endName: string;
  startLabel?: string;
  endLabel?: string;
  startValue?: string;
  endValue?: string;
  startError?: string;
  endError?: string;
  disabled?: boolean;
  required?: boolean;
}

export function DateRangeField({
  startId,
  endId,
  startName,
  endName,
  startLabel = 'Start date',
  endLabel = 'End date',
  startValue,
  endValue,
  startError,
  endError,
  disabled = false,
  required = false,
}: DateRangeFieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        id={startId}
        label={startLabel}
        required={required}
        error={startError}
      >
        <Input
          id={startId}
          name={startName}
          type="date"
          defaultValue={startValue}
          required={required}
          disabled={disabled}
          hasError={Boolean(startError)}
          aria-describedby={
            startError
              ? `${startId}-error`
              : undefined
          }
        />
      </FormField>

      <FormField
        id={endId}
        label={endLabel}
        required={required}
        error={endError}
      >
        <Input
          id={endId}
          name={endName}
          type="date"
          defaultValue={endValue}
          required={required}
          disabled={disabled}
          hasError={Boolean(endError)}
          aria-describedby={
            endError
              ? `${endId}-error`
              : undefined
          }
        />
      </FormField>
    </div>
  );
}