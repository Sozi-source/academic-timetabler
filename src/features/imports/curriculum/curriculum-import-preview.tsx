import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { CurriculumImportStagedRow } from './types';

function statusText(row: CurriculumImportStagedRow) {
  const data = row.normalizedData;
  if (row.status !== 'valid') return row.status;
  if ('resolution' in data) {
    if (data.resolution === 'match_existing') return 'Matched';
    if (data.resolution === 'normalize_existing') return 'Normalize name';
    if (data.resolution === 'create_new') return 'New unit';
  }
  return 'Ready';
}

export function CurriculumImportPreview({ rows }: { rows: CurriculumImportStagedRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold text-text-primary">Curriculum review</h2>
      </div>
      <TableContainer embedded label="Curriculum import preview">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Row</TableHead>
              <TableHead>Programme</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Unit Code</TableHead>
              <TableHead>Unit Name</TableHead>
              <TableHead>Resolution</TableHead>
              <TableHead>Issue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const data = row.normalizedData;
              const issues = [
                ...Object.values(row.fieldErrors).flat(),
                ...row.rowErrors,
              ];
              return (
                <TableRow key={row.id}>
                  <TableCell className="text-text-muted">{row.sourceRowNumber}</TableCell>
                  <TableCell className="font-semibold">{'programmeCode' in data ? data.programmeCode : '—'}</TableCell>
                  <TableCell>{'stage' in data ? data.stage : '—'}</TableCell>
                  <TableCell className="font-mono">{'code' in data ? data.code : '—'}</TableCell>
                  <TableCell>{'name' in data ? data.name : '—'}</TableCell>
                  <TableCell className="font-semibold">{statusText(row)}</TableCell>
                  <TableCell className="text-xs text-danger">{issues.join(' ') || '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  );
}
