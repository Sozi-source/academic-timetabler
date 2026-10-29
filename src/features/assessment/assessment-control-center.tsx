'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, FileText, GraduationCap, Search, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { AdminDepartmentMarksEntryControl } from './admin-department-marks-entry-control';
import type { AssessmentControlCenterData } from './control-center-queries';

export function AssessmentControlCenter({ data }: { data: AssessmentControlCenterData }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [submissionComponent, setSubmissionComponent] = useState('all');
  const [submissionStatus, setSubmissionStatus] = useState('all');
  const [needsAttention, setNeedsAttention] = useState(false);

  const submissionRows = useMemo(() => {
    const query = submissionSearch.trim().toLocaleLowerCase();
    return data.submissions.filter((row) => {
      if (submissionComponent !== 'all' && row.component !== submissionComponent) return false;
      if (submissionStatus !== 'all' && row.status !== submissionStatus) return false;
      if (needsAttention && row.status === 'Submitted') return false;
      if (!query) return true;
      return `${row.unit} ${row.unitCode} ${row.cohort} ${row.component} ${row.submittedBy ?? ''}`.toLocaleLowerCase().includes(query);
    });
  }, [data.submissions, needsAttention, submissionComponent, submissionSearch, submissionStatus]);

  const unitGroups = useMemo(() => {
    const byUnit = new Map<string, {
      unitId: string;
      unitIds: Set<string>;
      unitCode: string;
      unitCodes: Set<string>;
      unitName: string;
      trainerNames: Set<string>;
      registrationCount: number;
    }>();
    for (const item of data.items) {
      const groupKey = item.equivalenceGroupId ? `equivalence:${item.equivalenceGroupId}` : `unit:${item.unitId}`;
      let group = byUnit.get(groupKey);
      if (!group) {
        group = {
          unitId: item.unitId,
          unitIds: new Set(item.equivalentUnitIds),
          unitCode: item.equivalentUnitCodes[0] ?? item.unitCode,
          unitCodes: new Set(item.equivalentUnitCodes.length ? item.equivalentUnitCodes : [item.unitCode]),
          unitName: item.canonicalUnitName ?? item.unitName,
          trainerNames: new Set<string>(),
          registrationCount: 0,
        };
        byUnit.set(groupKey, group);
      }
      item.equivalentUnitIds.forEach((unitId) => group?.unitIds.add(unitId));
      item.equivalentUnitCodes.forEach((unitCode) => group?.unitCodes.add(unitCode));
      if (item.canonicalUnitName) group.unitName = item.canonicalUnitName;
      item.trainerNames.forEach((trainer) => group?.trainerNames.add(trainer));
      group.registrationCount = Math.max(
        group.registrationCount,
        ...[...group.unitIds].map((unitId) => data.unitRegistrationCounts[unitId] ?? 0),
      );
    }

    return [...byUnit.values()]
      .map((group) => ({
        ...group,
        unitCode: [...group.unitCodes].join(' · '),
        trainerList: [...group.trainerNames],
        registrationCount: group.registrationCount,
      }))
      .sort((first, second) => first.unitCode.localeCompare(second.unitCode));
  }, [data.items, data.unitRegistrationCounts]);

  const filteredUnitGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return unitGroups;
    return unitGroups.filter((group) =>
      group.unitCode.toLocaleLowerCase().includes(query) ||
      group.unitName.toLocaleLowerCase().includes(query) ||
      group.trainerList.some((trainer) => trainer.toLocaleLowerCase().includes(query)) ||
      data.items.some((item) => group.unitIds.has(item.unitId) && item.cohortName.toLocaleLowerCase().includes(query)),
    );
  }, [data.items, search, unitGroups]);

  const totalCurrentRegistrations = useMemo(() => {
    return unitGroups.reduce((total, group) => total + group.registrationCount, 0);
  }, [unitGroups]);

  const handlePeriodChange = (periodId: string) => {
    router.push(`/assessment?periodId=${periodId}`);
  };

  const statCards = [
    { label: 'Units', value: unitGroups.length, note: data.selectedPeriodName, icon: ClipboardList },
    { label: 'Current unit registrations', value: totalCurrentRegistrations, note: 'Each student is counted once per registered unit', icon: UsersRound },
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
            <AdminDepartmentMarksEntryControl
              periodId={data.selectedPeriodId}
              isOpen={data.marksEntryStatus.isOpen}
              openCount={data.marksEntryStatus.openCount}
              totalCount={data.marksEntryStatus.totalCount}
            />
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

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Submission tracker</h2>
            <p className="mt-0.5 text-xs text-slate-500">{submissionRows.length} components shown</p>
          </div>
          <button type="button" onClick={() => setNeedsAttention((current) => !current)} aria-pressed={needsAttention}
            className={`h-8 rounded-lg border px-3 text-xs font-medium ${needsAttention ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-border bg-surface text-slate-600 hover:bg-surface-subtle'}`}>
            Needs attention
          </button>
        </div>
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-[minmax(180px,1fr)_150px_150px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input type="search" value={submissionSearch} onChange={(event) => setSubmissionSearch(event.target.value)} placeholder="Search unit, cohort or trainer"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-slate-600 placeholder:text-slate-400 outline-none focus:border-primary" />
          </label>
          <select aria-label="Filter by component" value={submissionComponent} onChange={(event) => setSubmissionComponent(event.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs text-slate-600">
            <option value="all">All components</option>{['ASSIGNMENT', 'PRESENTATION', 'RAT', 'CAT', 'EXAM'].map((value) => <option key={value}>{value}</option>)}
          </select>
          <select aria-label="Filter by status" value={submissionStatus} onChange={(event) => setSubmissionStatus(event.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs text-slate-600">
            <option value="all">All statuses</option>{['Submitted', 'In progress', 'Not started'].map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
        {submissionRows.length === 0 ? <p className="px-4 py-8 text-center text-xs text-slate-500">No submissions match these filters.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-surface-subtle text-[10px] font-medium uppercase tracking-wide text-slate-500"><tr>
                <th className="px-4 py-2.5">Unit / cohort</th><th className="px-3 py-2.5">Component</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Submitted by</th><th className="px-3 py-2.5">Submitted</th><th className="px-4 py-2.5 text-right"> </th>
              </tr></thead>
              <tbody className="divide-y divide-border">{submissionRows.map((row) => <tr key={row.id} className="hover:bg-surface-subtle/60">
                <td className="px-4 py-2.5"><span className="block font-medium text-slate-700">{row.unit}</span><span className="text-[10px] text-slate-500">{row.unitCode}{row.unitCode ? ' · ' : ''}{row.cohort}</span></td>
                <td className="px-3 py-2.5 text-slate-600">{row.component}</td>
                <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${row.status === 'Submitted' ? 'bg-emerald-50 text-emerald-700' : row.status === 'In progress' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{row.status}</span></td>
                <td className="px-3 py-2.5 text-slate-600">{row.submittedBy ?? '—'}</td>
                <td className="px-3 py-2.5 text-slate-600">{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-2.5 text-right"><Link href={`/assessment/marks/${row.assessmentId}`} className="font-medium text-primary hover:underline">Open</Link></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
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

        {filteredUnitGroups.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm font-medium text-slate-600">{search ? `No units match “${search}”` : 'No unit markbooks found for this period.'}</p>
          </div>
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {filteredUnitGroups.map((unit) => (
              <article key={[...unit.unitIds].sort().join(':')} className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-2xs">
                <div>
                  <p className="font-semibold text-slate-800">{unit.unitName}</p>
                  <p className="mt-1 text-xs text-primary">{unit.unitCode}</p>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="min-w-0 truncate" title={unit.trainerList.join(', ')}>{unit.trainerList.join(', ') || 'Unassigned'}</span>
                  <span className="shrink-0">{unit.registrationCount} registered</span>
                </div>
                <Link
                  href={`/assessment/unit/${unit.unitId}?periodId=${data.selectedPeriodId}`}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-primary/20 bg-primary/5 px-3 text-sm font-semibold text-primary transition hover:bg-primary/10"
                >
                  View cohorts & marks
                </Link>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-2xs md:block">
            <table className="w-full min-w-[640px] table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[24%]" />
                <col className="w-[28%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="border-b border-border bg-surface-subtle text-[10px] font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Unit name</th>
                  <th className="px-3 py-3">Unit code</th>
                  <th className="px-3 py-3">Trainer</th>
                  <th className="px-3 py-3 text-center">Registered</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUnitGroups.map((unit) => (
                  <tr key={[...unit.unitIds].sort().join(':')} className="transition-colors hover:bg-surface-subtle/60">
                    <td className="px-4 py-3 font-medium text-slate-700" title={unit.unitName}>
                      <span className="block break-words">{unit.unitName}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex flex-wrap gap-x-1 rounded-md border border-primary/10 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary" title={unit.unitCode}>
                        {[...unit.unitCodes].map((code, index) => (
                          <span key={code} className="whitespace-nowrap">{index > 0 ? '· ' : ''}{code}</span>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <span className="block truncate" title={unit.trainerList.join(', ')}>{unit.trainerList.join(', ') || 'Unassigned'}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-medium tabular-nums text-slate-600">{unit.registrationCount}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/assessment/unit/${unit.unitId}?periodId=${data.selectedPeriodId}`}
                        className="inline-flex h-7 items-center justify-center rounded-lg border border-primary/20 bg-surface px-2.5 text-[11px] font-medium text-primary transition hover:bg-primary/5"
                      >
                        View cohorts & marks
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
