'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, FileText, GraduationCap, Search, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import type { AssessmentControlCenterData } from './control-center-queries';

export function AssessmentControlCenter({ data }: { data: AssessmentControlCenterData }) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return data.items;
    return data.items.filter((item) =>
      item.unitCode.toLocaleLowerCase().includes(query) ||
      item.unitName.toLocaleLowerCase().includes(query) ||
      item.trainerNames.some((trainer) => trainer.toLocaleLowerCase().includes(query)),
    );
  }, [data.items, search]);

  const handlePeriodChange = (periodId: string) => {
    router.push(`/assessment?periodId=${periodId}`);
  };

  const statCards = [
    { label: 'Markbooks', value: data.summary.totalMarkbooks, note: data.selectedPeriodName, icon: ClipboardList },
    { label: 'Current unit registrations', value: data.summary.totalPopulation, note: 'Each student is counted once per registered unit', icon: UsersRound },
    { label: 'Submitted markbooks', value: `${data.summary.submittedCount} / ${data.summary.totalMarkbooks}`, note: 'Marks submitted for HOD review', icon: GraduationCap },
  ];

  return (
    <div className="space-y-4 pb-10 text-slate-700">
      <PageHeader
        title="Results & Exams Analysis"
        icon={GraduationCap}
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{data.departmentName}</Badge>
            <select
              aria-label="Academic period"
              value={data.selectedPeriodId}
              onChange={(event) => handlePeriodChange(event.target.value)}
              className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-slate-600 shadow-2xs focus:border-primary focus:outline-none"
            >
              {data.periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name} {period.status === 'active' ? '(Active)' : `(${period.status})`}
                </option>
              ))}
            </select>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-slate-600 shadow-2xs transition hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" />
              Operations
            </Link>
            <Link
              href="/assessment/reports"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-slate-600 shadow-2xs transition hover:bg-surface-subtle"
            >
              <FileText className="size-3.5" />
              Reports
            </Link>
          </div>
        }
      />

      <section aria-label="Assessment summary" className="grid gap-3 sm:grid-cols-3">
        {statCards.map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="flex min-h-24 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-2xs">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-0.5 text-xl font-semibold leading-6 tabular-nums text-slate-700">{value}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{note}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Unit markbooks</h2>
            <p className="mt-0.5 text-xs text-slate-500">Candidate totals use current registered unit enrolments for the selected period.</p>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search unit or trainer"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-slate-600 placeholder:text-slate-400 shadow-2xs outline-none focus:border-primary"
            />
          </label>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm font-medium text-slate-600">{search ? `No units match “${search}”` : 'No unit markbooks found for this period.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-2xs">
            <table className="w-full min-w-[760px] table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[38%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="border-b border-border bg-surface-subtle text-[10px] font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-3 py-3">Trainer</th>
                  <th className="px-3 py-3 text-center">Registered</th>
                  <th className="px-3 py-3">Marks recorded</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-surface-subtle/60">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="shrink-0 whitespace-nowrap rounded-md border border-primary/10 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary">
                          {item.unitCode}
                        </span>
                        <span className="min-w-0 truncate font-medium text-slate-700" title={item.unitName}>{item.unitName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <span className="block truncate" title={item.trainerNames.join(', ')}>{item.trainerNames.join(', ') || 'Unassigned'}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-medium tabular-nums text-slate-600">{item.populationCount}</td>
                    <td className="px-3 py-3">
                      <span className="font-medium tabular-nums text-slate-600">{item.satCount} / {item.populationCount}</span>
                      <span className="ml-1.5 text-[10px] text-slate-500">{item.missingCount > 0 ? `${item.missingCount} pending` : 'complete'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/assessment/marks/${item.id}`}
                        className="inline-flex h-7 items-center justify-center rounded-lg border border-primary/20 bg-surface px-2.5 text-[11px] font-medium text-primary transition hover:bg-primary/5"
                      >
                        Markbook
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
