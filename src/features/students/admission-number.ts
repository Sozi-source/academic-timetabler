export interface AdmissionNumberInference {
  normalized: string;
  programmeCode: string | null;
  intakeCode: string | null;
  intakeLabel: string | null;
  admissionYear: number | null;
  serialNumber: string | null;
  confidence: 'high' | 'partial' | 'none';
  suggestedCohortCode: string | null;
  progressionGroupLabel: string | null;
  suggestedProgressionCohortCode: string | null;
}

const knownIntakeCodes: Record<string, string> = {
  J: 'JAN',
  MAR: 'MAR',
  M: 'MAY',
  S: 'SEP',
};

function progressionGroupFor(intakeLabel: string | null) {
  if (intakeLabel === 'JAN' || intakeLabel === 'MAR') return 'JAN-MAR';
  return intakeLabel;
}

/**
 * Parses admission-number structure as onboarding evidence only.
 * Example: CND/J-5678/IC/26 -> programme CND, January 2026.
 *
 * January and March remain distinct admission intakes, but both map to the
 * same JAN-MAR progression group because they follow the same operational
 * academic timeline. The admission cohort is never rewritten.
 *
 * The result must be matched against real programmes/cohorts and confirmed
 * before persistence. Lifecycle records always override admission-number
 * inference for students who defer, repeat or move cohorts.
 */
export function inferStudentAdmissionNumber(value: string): AdmissionNumberInference {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '');
  const parts = normalized.split('/');

  if (parts.length < 4) {
    return {
      normalized,
      programmeCode: null,
      intakeCode: null,
      intakeLabel: null,
      admissionYear: null,
      serialNumber: null,
      confidence: 'none',
      suggestedCohortCode: null,
      progressionGroupLabel: null,
      suggestedProgressionCohortCode: null,
    };
  }

  const programmeCode = parts[0] || null;
  const intakeSerial = parts[1] || '';
  const yearToken = parts.at(-1) || '';
  const intakeMatch = intakeSerial.match(/^([A-Z]+)-(.+)$/);
  const intakeCode = intakeMatch?.[1] ?? null;
  const serialNumber = intakeMatch?.[2] ?? null;
  const intakeLabel = intakeCode ? knownIntakeCodes[intakeCode] ?? null : null;
  const progressionGroupLabel = progressionGroupFor(intakeLabel);

  const numericYear = /^\d{2}$/.test(yearToken)
    ? 2000 + Number(yearToken)
    : /^\d{4}$/.test(yearToken)
      ? Number(yearToken)
      : null;

  const confidence = programmeCode && intakeCode && serialNumber && numericYear
    ? intakeLabel
      ? 'high'
      : 'partial'
    : 'none';

  return {
    normalized,
    programmeCode,
    intakeCode,
    intakeLabel,
    admissionYear: numericYear,
    serialNumber,
    confidence,
    suggestedCohortCode:
      programmeCode && intakeLabel && numericYear
        ? `${programmeCode} ${intakeLabel} ${String(numericYear).slice(-2)}`
        : null,
    progressionGroupLabel,
    suggestedProgressionCohortCode:
      programmeCode && progressionGroupLabel && numericYear
        ? `${programmeCode} ${progressionGroupLabel} ${String(numericYear).slice(-2)}`
        : null,
  };
}
