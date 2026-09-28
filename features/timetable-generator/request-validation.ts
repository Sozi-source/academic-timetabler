import type {
  GeneratorActionState,
  GeneratorRequest,
} from './server-types';

function readRequiredText(
  formData: FormData,
  fieldName: string,
): string {
  const value =
    formData.get(fieldName);

  return typeof value === 'string'
    ? value.trim()
    : '';
}

function readBoolean(
  formData: FormData,
  fieldName: string,
): boolean {
  const value =
    formData.get(fieldName);

  if (typeof value !== 'string') {
    return false;
  }

  return [
    '1',
    'true',
    'on',
    'yes',
  ].includes(
    value.trim().toLowerCase(),
  );
}

export function parseGeneratorRequest(
  formData: FormData,
):
  | {
      success: true;
      data: GeneratorRequest;
    }
  | {
      success: false;
      fieldErrors: NonNullable<
        GeneratorActionState[
          'fieldErrors'
        ]
      >;
    } {
  const academicPeriodId =
    readRequiredText(
      formData,
      'academicPeriodId',
    );

  const overwriteExisting =
    readBoolean(
      formData,
      'overwriteExisting',
    );

  const fieldErrors:
  NonNullable<
    GeneratorActionState[
      'fieldErrors'
    ]
  > = {};

  if (!academicPeriodId) {
    fieldErrors.academicPeriodId = [
      'Select an Academic Period before generating a timetable.',
    ];
  }

  if (
    academicPeriodId &&
    academicPeriodId.length > 100
  ) {
    fieldErrors.academicPeriodId = [
      'The selected Academic Period identifier is invalid.',
    ];
  }

  if (
    Object.keys(fieldErrors).length >
    0
  ) {
    return {
      success: false,
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      academicPeriodId,
      overwriteExisting,
    },
  };
}