import type { Metadata } from 'next';
import { GitMerge } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { approveEquivalenceGroupAction } from '@/features/unit-equivalence/actions';
import { getUnitEquivalenceWorkspace } from '@/features/unit-equivalence/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Unit equivalence review' };

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function UnitEquivalencePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { candidates, groups } = await getUnitEquivalenceWorkspace();
  const exact = new Map<string, typeof candidates>();
  for (const candidate of candidates.filter((row) => row.exact_group_size > 1 && !row.equivalence_group_id)) {
    exact.set(candidate.canonical_name, [...(exact.get(candidate.canonical_name) ?? []), candidate]);
  }
  const fuzzy = candidates.filter((row) => row.exact_group_size === 1 && !row.equivalence_group_id);

  return <div className="admin-screen space-y-5">
    <PageHeader
      title="Unit Equivalence"
      backHref="/timetable/unit-offerings"
      backLabel="Units on offer"
    />
    {params.error ? <Alert variant="danger" title="Equivalence was not approved">{String(params.error)}</Alert> : null}
    {params.approved ? <Alert variant="success" title="Canonical subject approved">Standardized {String(params.approved)} programme units while preserving their unique codes and identities.</Alert> : null}

    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-[3px] rounded-full bg-primary/60" aria-hidden="true" />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">Exact Normalized Candidates</h2>
      </div>
      {exact.size === 0 ? <Alert variant="info">No unreviewed exact-name groups remain.</Alert> : [...exact.entries()].map(([canonical, rows]) => (
        <form key={canonical} action={approveEquivalenceGroupAction}>
          <Card className="space-y-3 p-4">
            <div className="flex items-start gap-3"><GitMerge className="mt-1 size-5 text-primary" /><div><p className="font-semibold text-text-primary">{rows[0].unit_name}</p><p className="text-xs text-text-muted">Exact normalized match · academic approval required</p></div></div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <label key={row.unit_id} className="flex gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" name="unitId" value={row.unit_id} defaultChecked /><span><strong>{row.unit_code}</strong> — {row.unit_name}<br /><span className="text-xs text-text-muted">{row.programme_code} · {row.programme_name}</span></span></label>)}</div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><Input name="canonicalName" defaultValue={rows[0].unit_name} aria-label="Canonical unit name" required /><Input name="notes" placeholder="Academic review note (optional)" aria-label="Review note" /><Button type="submit">Approve equivalence</Button></div>
          </Card>
        </form>
      ))}
    </section>

    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-[3px] rounded-full bg-primary/60" aria-hidden="true" />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">Similarity Review Queue</h2>
      </div>
      {fuzzy.length === 0 ? <Alert>No fuzzy candidates require review.</Alert> : <TableContainer label="Similarity review queue"><Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead>Unit</TableHead><TableHead>Programme</TableHead><TableHead>Nearest title</TableHead><TableHead>Similarity</TableHead><TableHead>HOD review</TableHead></TableRow></TableHeader><TableBody>{fuzzy.map((row) => {
        const existingGroup = groups.find((group) => group.members.some((member) => member.unit_id === row.nearest_unit_id));
        return <TableRow key={row.unit_id}>
          <TableCell className="font-semibold text-text-primary" title={row.unit_code}>{row.unit_name}</TableCell>
          <TableCell className="text-text-secondary">{row.programme_code}</TableCell>
          <TableCell className="text-text-secondary">{row.nearest_unit_name ?? '—'}</TableCell>
          <TableCell className="font-mono text-text-secondary">{Math.round(row.similarity_score * 100)}%</TableCell>
          <TableCell>
            {row.nearest_unit_id && existingGroup ? (
              <form action={approveEquivalenceGroupAction} className="inline-flex items-center gap-2">
                <input type="hidden" name="unitId" value={row.unit_id} />
                <input type="hidden" name="canonicalName" value={existingGroup.canonical_name} />
                <input type="hidden" name="notes" value={`HOD-reviewed match with ${row.nearest_unit_name ?? 'the existing canonical subject'}.`} />
                <span className="text-xs text-text-muted">Add to “{existingGroup.canonical_name}”</span>
                <Button type="submit" size="sm">Approve and add</Button>
              </form>
            ) : row.nearest_unit_id ? (
              <form action={approveEquivalenceGroupAction} className="inline-flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" name="unitId" value={row.unit_id} defaultChecked /><span>{row.unit_code}</span></label>
                <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" name="unitId" value={row.nearest_unit_id} defaultChecked /><span>Match</span></label>
                <Input name="canonicalName" defaultValue={row.nearest_unit_name ?? row.unit_name} aria-label="Canonical unit name" className="h-8 w-44 text-xs" required />
                <Input name="notes" placeholder="Note (optional)" aria-label="Review note" className="h-8 w-36 text-xs" />
                <Button type="submit" size="sm">Approve</Button>
              </form>
            ) : <span className="text-xs text-text-muted">No unit to compare</span>}
          </TableCell>
        </TableRow>;
      })}</TableBody></Table></TableContainer>}
    </section>

    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-[3px] rounded-full bg-primary/60" aria-hidden="true" />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">Approved Canonical Subjects</h2>
      </div>
      {groups.length === 0 ? <Alert>No equivalence groups have been approved.</Alert> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{groups.map((group) => <Card key={group.id} className="p-4"><p className="font-semibold text-text-primary">{group.canonical_name}</p><ul className="mt-2 space-y-1 text-xs text-text-muted">{group.members.map((member) => <li key={member.unit_id}>{member.units?.code} · {member.units?.programmes?.code ?? 'Programme'}</li>)}</ul></Card>)}</div>}
    </section>
  </div>;
}
