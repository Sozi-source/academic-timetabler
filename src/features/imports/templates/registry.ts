import type {
  ImportEntityType,
  ImportTemplateDefinition,
} from '../types';

import {
  cohortsImportTemplate,
} from './cohorts';

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
import { studentsImportTemplate } from './students';
import { curriculumImportTemplate } from './curriculum';
export const importTemplateRegistry:
Partial<
  Record<
    ImportEntityType,
    ImportTemplateDefinition
  >
> = {
  cohorts: cohortsImportTemplate,
  trainers: trainersImportTemplate,
  rooms: roomsImportTemplate,
  programmes: programmesImportTemplate,
  units: unitsImportTemplate,
  teaching_allocations:
    teachingAllocationsImportTemplate,
  unit_offerings: unitOfferingsImportTemplate,
  students: studentsImportTemplate,
  curriculum: curriculumImportTemplate,
};

export function getImportTemplateDefinition(
  entityType: string,
) {
  return importTemplateRegistry[
    entityType as ImportEntityType
  ] ?? null;
}
