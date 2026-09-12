/**
 * TVET MASTER CURRICULUM REGISTRY AGGREGATOR
 *
 * Official KNEC Diploma & Certificate in Nutrition & Dietetics Curriculum.
 * Aggregates all 43 units across Modules I, II, and III, harmonized with
 * shared unit resolution across CND and DND programmes.
 */

import { MODULE_1_CURRICULUM } from './module-1';
import { MODULE_2_CURRICULUM } from './module-2';
import { MODULE_3_CURRICULUM } from './module-3';
import { resolveCanonicalKey } from './shared-map';
import type { CanonicalCurriculumUnit, UnitCurriculumDefinition } from './types';

export * from './types';
export * from './shared-map';
export { MODULE_1_CURRICULUM } from './module-1';
export { MODULE_2_CURRICULUM } from './module-2';
export { MODULE_3_CURRICULUM } from './module-3';

/**
 * Authoritative master registry of all 43 canonical curriculum units
 */
export const MASTER_CURRICULUM_REGISTRY: Record<string, CanonicalCurriculumUnit> = {
  ...MODULE_1_CURRICULUM,
  ...MODULE_2_CURRICULUM,
  ...MODULE_3_CURRICULUM,
};

/**
 * Returns all 43 canonical curriculum units as an array.
 */
export function getAllCurriculumUnits(): CanonicalCurriculumUnit[] {
  return Object.values(MASTER_CURRICULUM_REGISTRY);
}

/**
 * Looks up a canonical curriculum unit by its canonical key (e.g. "diet_therapy_i").
 */
export function getCanonicalCurriculumByKey(canonicalKey: string): CanonicalCurriculumUnit | undefined {
  return MASTER_CURRICULUM_REGISTRY[canonicalKey];
}

/**
 * Finds a canonical curriculum unit using code and/or unit title.
 * Automatically resolves shared aliases between CND and DND so both programs
 * share the exact same underlying curriculum resources.
 */
export function findCanonicalCurriculum(
  unitCode: string,
  unitName?: string
): CanonicalCurriculumUnit | undefined {
  // 1. Resolve via shared alias map
  const canonicalKey = resolveCanonicalKey(unitCode, unitName);
  if (canonicalKey && MASTER_CURRICULUM_REGISTRY[canonicalKey]) {
    return MASTER_CURRICULUM_REGISTRY[canonicalKey];
  }

  // 2. Direct key lookup if unitCode itself is a canonicalKey
  if (MASTER_CURRICULUM_REGISTRY[unitCode]) {
    return MASTER_CURRICULUM_REGISTRY[unitCode];
  }

  // 3. Fallback fuzzy search across unitName and aliases
  const searchName = (unitName || unitCode).toLowerCase().trim();
  for (const unit of Object.values(MASTER_CURRICULUM_REGISTRY)) {
    if (
      unit.unitName.toLowerCase() === searchName ||
      unit.unitName.toLowerCase().includes(searchName) ||
      searchName.includes(unit.unitName.toLowerCase())
    ) {
      return unit;
    }
    for (const alias of unit.aliases) {
      if (alias.toLowerCase() === searchName) {
        return unit;
      }
    }
  }

  return undefined;
}

/**
 * Adapts the canonical unit to a caller-specific UnitCurriculumDefinition.
 * Retains the requested unitCode and unitName while injecting the complete
 * 14-week schedule, competencies, outcomes, references, and equipment.
 */
export function getCanonicalCurriculumDefinition(
  unitCode: string,
  unitName: string
): UnitCurriculumDefinition | undefined {
  const canonical = findCanonicalCurriculum(unitCode, unitName);
  if (!canonical) {
    return undefined;
  }

  return {
    ...canonical,
    unitCode: unitCode.trim() || canonical.unitCode,
    unitName: unitName.trim() || canonical.unitName,
  };
}
