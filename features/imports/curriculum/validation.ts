import { z } from 'zod';

export const curriculumImportRowSchema = z.object({
  programmeCode: z.preprocess(
    (value) => String(value ?? '').trim().toUpperCase(),
    z.string().min(1, 'Enter the programme code.').max(40),
  ),
  stage: z.preprocess(
    (value) => String(value ?? '').trim().toUpperCase(),
    z.string().regex(/^Y[1-3]S[1-3]$/, 'Use the YxSy stage format, for example Y1S1.'),
  ),
  code: z.preprocess(
    (value) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' '),
    z.string().min(1, 'Enter the unit code.').max(50),
  ),
  name: z.preprocess(
    (value) => String(value ?? '').trim().replace(/\s+/g, ' '),
    z.string().min(2, 'Enter the official unit name.').max(180),
  ),
});
