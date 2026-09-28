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
        <p className="mt-1 text-sm text-text-muted">Review matching and conflicts before committing.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">Row</th>
              <th className="px-4 py-3">Programme</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Unit Code</th>
              <th className="px-4 py-3">Unit Name</th>
              <th className="px-4 py-3">Resolution</th>
              <th className="px-4 py-3">Issue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const data = row.normalizedData;
              const issues = [
                ...Object.values(row.fieldErrors).flat(),
                ...row.rowErrors,
              ];
              return (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-text-muted">{row.sourceRowNumber}</td>
                  <td className="px-4 py-3 font-semibold">{'programmeCode' in data ? data.programmeCode : '—'}</td>
                  <td className="px-4 py-3">{'stage' in data ? data.stage : '—'}</td>
                  <td className="px-4 py-3">{'code' in data ? data.code : '—'}</td>
                  <td className="px-4 py-3">{'name' in data ? data.name : '—'}</td>
                  <td className="px-4 py-3 font-semibold">{statusText(row)}</td>
                  <td className="max-w-sm px-4 py-3 text-xs text-danger">{issues.join(' ') || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
