import type {
  ImportEntityType,
  ImportTemplateDefinition,
} from '../types';

import {
  programmesImportTemplate,
} from './programmes';
import {
  roomsImportTemplate,
} from './rooms';
import {
  teachingAllocationsImportTemplate,
} from './teaching-allocations';
import {
  trainersImportTemplate,
} from './trainers';
import {
  unitsImportTemplate,
} from './units';

import {
  unitOfferingsImportTemplate,
} from '../unit-offerings/template';
export const importTemplateRegistry:
Partial<
  Record<
    ImportEntityType,
    ImportTemplateDefinition
  >
> = {
  trainers: trainersImportTemplate,
  rooms: roomsImportTemplate,
  programmes: programmesImportTemplate,
  units: unitsImportTemplate,
  teaching_allocations:
    teachingAllocationsImportTemplate,
  unit_offerings: unitOfferingsImportTemplate,
};

export function getImportTemplateDefinition(
  entityType: string,
) {
  return importTemplateRegistry[
    entityType as ImportEntityType
  ] ?? null;
}