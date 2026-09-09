import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, GitMerge } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { approveEquivalenceGroupAction } from '@/features/unit-equivalence/actions';
import { getUnitEquivalenceWorkspace } from '@/features/unit-equivalence/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Unit equivalence review' };

export default async function UnitEquivalencePage({ searchParams }: PageProps<'/timetable/unit-equivalence'>) {
  const params = await searchParams;
  const { candidates, groups } = await getUnitEquivalenceWorkspace();
  const exact = new Map<string, typeof candidates>();
  for (const candidate of candidates.filter((row) => row.exact_group_size > 1 && !row.equivalence_group_id)) {
    exact.set(candidate.canonical_name, [...(exact.get(candidate.canonical_name) ?? []), candidate]);
  }
  const fuzzy = candidates.filter((row) => row.exact_group_size === 1 && !row.equivalence_group_id);

  return <div className="space-y-5">
    <PageHeader title="Unit equivalence review" description="Approve academic equivalence once; sharing remains a separate period-specific decision." actions={<Button asChild variant="outline"><Link href="/timetable/unit-offerings"><ArrowLeft className="size-4" />Units on offer</Link></Button>} />
    {params.error ? <Alert variant="danger" title="Equivalence was not approved">{String(params.error)}</Alert> : null}
    {params.approved ? <Alert variant="success" title="Canonical subject approved">Standardized {String(params.approved)} programme units while preserving their unique codes and identities.</Alert> : null}

    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Exact normalized-name candidates</h2>
      {exact.size === 0 ? <Alert variant="info">No unreviewed exact-name groups remain.</Alert> : [...exact.entries()].map(([canonical, rows]) => (
        <form key={canonical} action={approveEquivalenceGroupAction}>
          <Card className="space-y-3 p-4">
            <div className="flex items-start gap-3"><GitMerge className="mt-1 size-5 text-primary" /><div><p className="font-semibold">{rows[0].unit_name}</p><p className="text-xs text-text-muted">Exact normalized match · academic approval required</p></div></div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <label key={row.unit_id} className="flex gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" name="unitId" value={row.unit_id} defaultChecked /><span><strong>{row.unit_code}</strong> — {row.unit_name}<br /><span className="text-xs text-text-muted">{row.programme_code} · {row.programme_name}</span></span></label>)}</div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><Input name="canonicalName" defaultValue={rows[0].unit_name} aria-label="Canonical unit name" required /><Input name="notes" placeholder="Academic review note (optional)" aria-label="Review note" /><Button type="submit">Approve equivalence</Button></div>
          </Card>
        </form>
      ))}
    </section>

    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Similarity review queue</h2>
      <p className="text-sm text-text-muted">These are suggestions only. Similarity never renames, approves, allocates, or merges a unit.</p>
      {fuzzy.length === 0 ? <Alert>No fuzzy candidates require review.</Alert> : <div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-primary text-white"><tr><th className="p-3">Unit</th><th className="p-3">Nearest title</th><th className="p-3">Similarity</th></tr></thead><tbody className="divide-y divide-border">{fuzzy.map((row) => <tr key={row.unit_id}><td className="p-3"><strong>{row.unit_code}</strong> — {row.unit_name}<div className="text-xs text-text-muted">{row.programme_code}</div></td><td className="p-3">{row.nearest_unit_name ?? '—'}</td><td className="p-3">{Math.round(row.similarity_score * 100)}%</td></tr>)}</tbody></table></div>}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Approved canonical subjects</h2>{groups.length === 0 ? <Alert>No equivalence groups have been approved.</Alert> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{groups.map((group) => <Card key={group.id} className="p-4"><p className="font-semibold">{group.canonical_name}</p><ul className="mt-2 space-y-1 text-sm text-text-muted">{group.members.map((member) => <li key={member.unit_id}>{member.units?.code} · {member.units?.programmes?.code ?? 'Programme'}</li>)}</ul></Card>)}</div>}</section>
  </div>;
}
