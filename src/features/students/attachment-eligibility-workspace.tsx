'use client';

import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Download,
  Filter,
  Printer,
  Search,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';

import { transitionStudentsToAttachmentAction } from './attachment-actions';
import type {
  AttachmentCandidate,
  AttachmentStageRule,
  ManualOverrideStudentOption,
} from './attachment-eligibility';

interface AttachmentEligibilityWorkspaceProps {
  departmentName: string;
  rules: AttachmentStageRule[];
  initialCandidates: AttachmentCandidate[];
  otherActiveStudents: ManualOverrideStudentOption[];
}

export function AttachmentEligibilityWorkspace({
  departmentName,
  rules,
  initialCandidates,
  otherActiveStudents,
}: AttachmentEligibilityWorkspaceProps) {
  const router = useRouter();
  const [isTransitioning, startTransitioning] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  // Manual overrides added by HOD during review
  const [manualCandidates, setManualCandidates] = useState<AttachmentCandidate[]>([]);
  const [manualNotes, setManualNotes] = useState<Record<string, string>>({});

  // Excluded student IDs (all auto + manual candidates are approved by default)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  const [exclusionReasons, setExclusionReasons] = useState<Record<string, string>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgramme, setSelectedProgramme] = useState('all');
  const [selectedCohort, setSelectedCohort] = useState('all');
  const [selectedApproval, setSelectedApproval] = useState<'all' | 'approved' | 'excluded' | 'flagged'>('all');

  // Manual override panel state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [overrideSearch, setOverrideSearch] = useState('');
  const [overrideStudentId, setOverrideStudentId] = useState('');
  const [overrideRuleKey, setOverrideRuleKey] = useState(rules[0]?.attachmentStageId ?? '');
  const [overrideReason, setOverrideReason] = useState('');

  // Banners
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allCandidates = useMemo(
    () => [...initialCandidates, ...manualCandidates],
    [initialCandidates, manualCandidates],
  );

  const allCandidateIdSet = useMemo(
    () => new Set(allCandidates.map((c) => c.studentId)),
    [allCandidates],
  );

  const programmes = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCandidates) {
      map.set(c.programmeCode, c.programmeName);
    }
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [allCandidates]);

  const cohorts = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCandidates) {
      if (selectedProgramme === 'all' || c.programmeCode === selectedProgramme) {
        set.add(c.cohortName);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allCandidates, selectedProgramme]);

  const approvedCandidates = useMemo(
    () => allCandidates.filter((c) => !excludedIds.has(c.studentId)),
    [allCandidates, excludedIds],
  );

  const flaggedCount = useMemo(
    () => allCandidates.filter((c) => c.isTransferStudent || c.referredUnitCount > 0).length,
    [allCandidates],
  );

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allCandidates.filter((c) => {
      if (q) {
        const hit =
          c.fullName.toLowerCase().includes(q) ||
          c.admissionNumber.toLowerCase().includes(q) ||
          c.cohortName.toLowerCase().includes(q) ||
          c.attachmentUnitCode.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (selectedProgramme !== 'all' && c.programmeCode !== selectedProgramme) return false;
      if (selectedCohort !== 'all' && c.cohortName !== selectedCohort) return false;
      const isExcluded = excludedIds.has(c.studentId);
      if (selectedApproval === 'approved' && isExcluded) return false;
      if (selectedApproval === 'excluded' && !isExcluded) return false;
      if (selectedApproval === 'flagged' && !c.isTransferStudent && c.referredUnitCount === 0) return false;
      return true;
    });
  }, [allCandidates, searchQuery, selectedProgramme, selectedCohort, selectedApproval, excludedIds]);

  const availableOverrideStudents = useMemo(() => {
    const q = overrideSearch.trim().toLowerCase();
    return otherActiveStudents
      .filter((s) => !allCandidateIdSet.has(s.studentId))
      .filter((s) => {
        if (!q) return true;
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          s.programmeCode.toLowerCase().includes(q) ||
          s.cohortName.toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [otherActiveStudents, allCandidateIdSet, overrideSearch]);

  function toggleStudentApproval(studentId: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function handleAddManualOverride() {
    setErrorMessage(null);
    const student = otherActiveStudents.find((s) => s.studentId === overrideStudentId);
    if (!student) {
      setErrorMessage('Select an active student to add as a manual override.');
      return;
    }
    const chosenRule =
      rules.find((r) => r.attachmentStageId === overrideRuleKey) ??
      rules.find((r) => r.programmeId === student.programmeId) ??
      rules[0];

    const newCandidate: AttachmentCandidate = {
      studentId: student.studentId,
      admissionNumber: student.admissionNumber,
      fullName: student.fullName,
      programmeId: student.programmeId,
      programmeCode: student.programmeCode,
      programmeName: student.programmeName,
      cohortId: student.cohortId,
      cohortCode: student.cohortCode,
      cohortName: student.cohortName,
      currentStageId: student.currentStageId,
      currentStageCode: student.currentStageCode,
      attachmentStageId: chosenRule?.attachmentStageId ?? null,
      attachmentStageCode: chosenRule?.attachmentStageCode ?? 'Attachment',
      attachmentUnitCode: chosenRule?.attachmentUnitCode ?? 'ATT',
      attachmentUnitName: chosenRule?.attachmentUnitName ?? 'Industrial Attachment',
      isTransferStudent: false,
      referredUnitCount: 0,
      source: 'manual',
    };

    setManualCandidates((prev) => [...prev, newCandidate]);
    if (overrideReason.trim()) {
      setManualNotes((prev) => ({ ...prev, [student.studentId]: overrideReason.trim() }));
    }
    setOverrideStudentId('');
    setOverrideReason('');
    setShowAddPanel(false);
    setStatusMessage(`Added ${student.fullName} (${student.admissionNumber}) as a manual override.`);
  }

  function removeManualOverride(studentId: string) {
    setManualCandidates((prev) => prev.filter((c) => c.studentId !== studentId));
    setExcludedIds((prev) => {
      if (!prev.has(studentId)) return prev;
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
  }

  async function handleExportExcel() {
    if (approvedCandidates.length === 0) {
      setErrorMessage('Select at least one approved student before exporting.');
      return;
    }
    setErrorMessage(null);
    setIsExporting(true);
    try {
      const payload = {
        rows: approvedCandidates.map((c) => {
          const notesParts: string[] = [];
          if (c.isTransferStudent) notesParts.push('Transfer student');
          if (c.referredUnitCount > 0) notesParts.push(`${c.referredUnitCount} referred unit(s)`);
          if (manualNotes[c.studentId]) notesParts.push(manualNotes[c.studentId]);
          return {
            admissionNumber: c.admissionNumber,
            fullName: c.fullName,
            programmeCode: c.programmeCode,
            cohortName: c.cohortName,
            currentStageCode: c.currentStageCode,
            attachmentStageCode: c.attachmentStageCode,
            attachmentUnitCode: c.attachmentUnitCode,
            attachmentUnitName: c.attachmentUnitName,
            source: c.source,
            notes: notesParts.join('; '),
          };
        }),
      };

      const res = await fetch('/api/students/attachment/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setErrorMessage(err?.message || 'Unable to export attachment list.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Next_Semester_Attachment_List.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  function handleTransitionApproved() {
    if (approvedCandidates.length === 0) {
      setErrorMessage('No approved students selected to transition.');
      return;
    }
    const confirmed = window.confirm(
      `Move ${approvedCandidates.length} approved student${approvedCandidates.length === 1 ? '' : 's'} to "On Attachment" and advance them to their attachment stage? This updates their academic phase immediately.`,
    );
    if (!confirmed) return;

    setErrorMessage(null);
    setStatusMessage(null);

    startTransitioning(async () => {
      const result = await transitionStudentsToAttachmentAction({
        entries: approvedCandidates.map((c) => ({
          studentId: c.studentId,
          targetStageId: c.attachmentStageId,
        })),
      });
      if ('message' in result) {
        setErrorMessage(result.message);
        return;
      }
      setManualCandidates([]);
      setExcludedIds(new Set());
      setStatusMessage(
        `Successfully transitioned ${result.updatedCount} student${result.updatedCount === 1 ? '' : 's'} to On Attachment.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* KPI Metrics */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 print:hidden">
        <MetricCard
          label="Auto-Detected Due"
          value={String(initialCandidates.length)}
          description="From curriculum stages"
          icon={UsersRound}
        />
        <MetricCard
          label="Approved List"
          value={String(approvedCandidates.length)}
          description="Ready for placement"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Excluded"
          value={String(excludedIds.size)}
          description="Held back / deferred"
          icon={X}
        />
        <MetricCard
          label="Manual Overrides"
          value={String(manualCandidates.length)}
          description={flaggedCount > 0 ? `${flaggedCount} with warnings` : 'No flags'}
          icon={Briefcase}
        />
      </div>

      {/* Curriculum Attachment Rules */}
      {rules.length > 0 ? (
        <Card className="p-3.5 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Curriculum Attachment Stage Rules ({rules.length})
            </h2>
            <span className="text-[11px] text-slate-500">
              Active in-class students in the stage immediately preceding attachment are auto-selected
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {rules.map((r) => (
              <button
                key={r.precedingStageId}
                type="button"
                onClick={() =>
                  setSelectedProgramme(selectedProgramme === r.programmeCode ? 'all' : r.programmeCode)
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition cursor-pointer ${
                  selectedProgramme === r.programmeCode
                    ? 'border-primary bg-primary text-primary-foreground shadow-2xs'
                    : r.dueCount > 0
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 hover:bg-emerald-100/70'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span className="font-bold">{r.programmeCode}</span>
                <span className="font-mono text-[11px] opacity-85">
                  {r.precedingStageCode} → {r.attachmentStageCode}
                </span>
                <span className="text-[11px] opacity-75">({r.attachmentUnitCode})</span>
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    selectedProgramme === r.programmeCode
                      ? 'bg-white/20 text-white'
                      : r.dueCount > 0
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {r.dueCount}
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Feedback Banners */}
      {statusMessage ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 print:hidden">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </span>
          <button type="button" onClick={() => setStatusMessage(null)} className="rounded p-0.5 hover:bg-emerald-100 cursor-pointer" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800 print:hidden">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="rounded p-0.5 hover:bg-rose-100 cursor-pointer" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* Action & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[210px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student, admission no..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <select
            value={selectedProgramme}
            onChange={(e) => {
              setSelectedProgramme(e.target.value);
              setSelectedCohort('all');
            }}
            aria-label="Filter by programme"
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-primary focus:outline-none cursor-pointer"
          >
            <option value="all">All Programmes</option>
            {programmes.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code}
              </option>
            ))}
          </select>

          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            aria-label="Filter by cohort"
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-primary focus:outline-none cursor-pointer"
          >
            <option value="all">All Cohorts</option>
            {cohorts.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedApproval}
              onChange={(e) => setSelectedApproval(e.target.value as typeof selectedApproval)}
              aria-label="Filter by approval status"
              className="h-9 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs font-semibold text-slate-700 shadow-2xs focus:border-primary focus:outline-none cursor-pointer"
            >
              <option value="all">All ({allCandidates.length})</option>
              <option value="approved">Approved ({approvedCandidates.length})</option>
              <option value="excluded">Excluded ({excludedIds.size})</option>
              <option value="flagged">With Warnings ({flaggedCount})</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddPanel((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
          >
            <UserPlus className="size-3.5 text-slate-500" />
            <span>Add Override</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="size-3.5 text-slate-500" />
            <span>Print</span>
          </button>

          <button
            type="button"
            disabled={approvedCandidates.length === 0 || isExporting}
            onClick={handleExportExcel}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-700 bg-white px-3 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>{isExporting ? 'Exporting...' : `Export Excel (${approvedCandidates.length})`}</span>
          </button>

          <button
            type="button"
            disabled={approvedCandidates.length === 0 || isTransitioning}
            onClick={handleTransitionApproved}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
          >
            <Briefcase className="size-3.5" />
            <span>
              {isTransitioning
                ? 'Transitioning...'
                : `Move to Attachment (${approvedCandidates.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Manual Override Panel */}
      {showAddPanel ? (
        <Card className="border-emerald-200 bg-emerald-50/40 p-4 print:hidden">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Add Exception Student Manually</h3>
              <p className="text-[11px] text-slate-600">
                Include an active student who is outside the automatic stage rule (e.g., deferred previous attachment or transfer).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddPanel(false)}
              className="rounded p-1 text-slate-500 hover:bg-white cursor-pointer"
              aria-label="Close panel"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-4">
            <input
              type="text"
              value={overrideSearch}
              onChange={(e) => setOverrideSearch(e.target.value)}
              placeholder="Filter student by name / adm no..."
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900"
            />
            <select
              value={overrideStudentId}
              onChange={(e) => setOverrideStudentId(e.target.value)}
              aria-label="Select student to add"
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
            >
              <option value="">Select active student…</option>
              {availableOverrideStudents.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.admissionNumber} — {s.fullName} ({s.programmeCode} · {s.currentStageCode})
                </option>
              ))}
            </select>
            <select
              value={overrideRuleKey}
              onChange={(e) => setOverrideRuleKey(e.target.value)}
              aria-label="Select attachment stage"
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
            >
              {rules.map((r) => (
                <option key={r.attachmentStageId} value={r.attachmentStageId}>
                  {r.programmeCode} {r.attachmentStageCode} — {r.attachmentUnitCode}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason (optional)"
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={handleAddManualOverride}
                className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Printable Header */}
      <div className="hidden print:block border-b border-slate-300 pb-2 mb-3">
        <h1 className="text-base font-bold text-slate-900">
          IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES
        </h1>
        <p className="text-xs font-semibold text-slate-700">
          NEXT SEMESTER INDUSTRIAL ATTACHMENT ELIGIBILITY LIST — {departmentName}
        </p>
        <p className="text-[11px] text-slate-500">
          Approved Students: {approvedCandidates.length}
        </p>
      </div>

      {/* Candidate Review Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-10 px-3 py-3 text-center print:hidden">Approve</th>
                <th className="w-10 px-2 py-3 text-center">No.</th>
                <th className="px-3 py-3 whitespace-nowrap">Admission No.</th>
                <th className="px-3 py-3 whitespace-nowrap">Student Full Name</th>
                <th className="px-3 py-3 whitespace-nowrap">Programme &amp; Cohort</th>
                <th className="px-3 py-3 whitespace-nowrap">Stage Progression</th>
                <th className="px-3 py-3 whitespace-nowrap">Attachment Unit</th>
                <th className="px-3 py-3 whitespace-nowrap">Flags / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">No students match the current filters.</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Adjust your search/filters or use &ldquo;Add Override&rdquo; to include a student manually.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((c, idx) => {
                  const isExcluded = excludedIds.has(c.studentId);
                  return (
                    <tr
                      key={c.studentId}
                      className={`transition-colors ${
                        isExcluded ? 'bg-slate-50/80 opacity-60 print:hidden' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center print:hidden">
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => toggleStudentApproval(c.studentId)}
                          aria-label={`Approve ${c.fullName} for attachment`}
                          className="size-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-center text-slate-400 font-medium">{idx + 1}.</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {c.admissionNumber}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                        <Link
                          href={`/students/registry/${c.studentId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {c.fullName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{c.programmeCode}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="text-slate-600">{c.cohortName}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                          {c.currentStageCode}
                          <ArrowRight className="size-3 text-slate-400" />
                          <span className="text-emerald-800">{c.attachmentStageCode}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] font-semibold text-slate-700">
                          {c.attachmentUnitCode}
                        </span>
                        <span className="ml-1.5 text-slate-600">{c.attachmentUnitName}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.source === 'manual' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200">
                              Manual
                              <button
                                type="button"
                                onClick={() => removeManualOverride(c.studentId)}
                                className="hover:text-sky-950 cursor-pointer print:hidden"
                                aria-label={`Remove manual override ${c.fullName}`}
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ) : null}
                          {c.isTransferStudent ? (
                            <Badge variant="neutral" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                              Transfer
                            </Badge>
                          ) : null}
                          {c.referredUnitCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
                              <AlertTriangle className="size-3" />
                              {c.referredUnitCount} Refer
                            </span>
                          ) : null}
                          {manualNotes[c.studentId] ? (
                            <span className="text-[11px] text-slate-600">{manualNotes[c.studentId]}</span>
                          ) : null}
                          {isExcluded ? (
                            <input
                              type="text"
                              value={exclusionReasons[c.studentId] ?? ''}
                              onChange={(e) =>
                                setExclusionReasons((prev) => ({ ...prev, [c.studentId]: e.target.value }))
                              }
                              placeholder="Reason for exclusion..."
                              className="h-6 rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-700 print:hidden"
                            />
                          ) : !c.isTransferStudent && c.referredUnitCount === 0 && c.source === 'auto' ? (
                            <span className="text-[11px] text-emerald-700 font-medium">Eligible</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
