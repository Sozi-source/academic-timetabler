'use client';

import { ArrowLeft, Download } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface CandidateItem {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  cohortName?: string;
}

interface SigningSheetProps {
  type: 'cat' | 'exam';
  allocationId: string;
  unitCode: string;
  unitName: string;
  cohortName: string;
  periodName: string;
  trainerName: string;
  institutionName?: string;
  campusName?: string;
  schoolName?: string;
  departmentName?: string;
  programmeName?: string;
  venueName?: string;
  candidates: CandidateItem[];
}

export function PrintableSigningSheet({
  type,
  allocationId,
  unitCode,
  unitName,
  cohortName,
  periodName,
  trainerName,
  institutionName = 'Imperial College of Medical and Health Sciences',
  schoolName = 'Imperial',
  departmentName = 'Applied Science',
  programmeName = 'Diploma in Science Laboratory Technology',
  venueName,
  candidates,
}: SigningSheetProps) {
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const isExam = type === 'exam';
  const title = isExam
    ? 'FINAL EXAMINATION ATTENDANCE & SCRIPT REGISTER'
    : 'CONTINUOUS ASSESSMENT TEST (CAT) ATTENDANCE LIST';

  // 4 blank rows for late add-ons
  const blankRowsCount = 4;

  // Group candidates by cohort if multiple cohorts are present
  const cohortGroups = useMemo(() => {
    const groups = new Map<string, CandidateItem[]>();
    for (const cand of candidates) {
      const cName = cand.cohortName || cohortName || 'Cohort';
      if (!groups.has(cName)) {
        groups.set(cName, []);
      }
      groups.get(cName)!.push(cand);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cName, list]) => ({
        cohortName: cName,
        candidates: list,
      }));
  }, [candidates, cohortName]);

  const displayedGroups = selectedCohort === 'all'
    ? cohortGroups
    : cohortGroups.filter((g) => g.cohortName === selectedCohort);

  return (
    <div className="space-y-4">
      {/* Non-printable action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-3 shadow-xs print:hidden">
        <Link
          href={`/staff/units/${allocationId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Back to Unit
        </Link>

        {/* Cohort separation tabs when multiple cohorts are present */}
        {cohortGroups.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="font-semibold text-text-muted mr-1">Sheets:</span>
            <button
              type="button"
              onClick={() => setSelectedCohort('all')}
              className={`h-7 rounded-md px-2.5 text-xs font-bold transition ${
                selectedCohort === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-border bg-surface-subtle text-text-secondary hover:bg-surface'
              }`}
            >
              All Cohorts ({candidates.length})
            </button>
            {cohortGroups.map((g) => (
              <button
                key={g.cohortName}
                type="button"
                onClick={() => setSelectedCohort(g.cohortName)}
                className={`h-7 rounded-md px-2.5 text-xs font-bold transition ${
                  selectedCohort === g.cohortName
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'border border-border bg-surface-subtle text-text-secondary hover:bg-surface'
                }`}
              >
                {g.cohortName} ({g.candidates.length})
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted mr-2">
            <strong className="text-text-primary">{candidates.length}</strong> registered candidates
          </span>

          <a
            href={`/api/staff/units/${allocationId}/attendance-sheet/${type}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-text-secondary shadow-xs transition hover:bg-surface-subtle"
          >
            <Download className="size-3.5" />
            Download Word (.docx)
          </a>

          <a
            href={`/api/staff/units/${allocationId}/attendance-sheet/${type}?format=pdf`}
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover"
          >
            <Download className="size-3.5" />
            Download PDF
          </a>
        </div>
      </div>

      {/* Official Printable Sheet(s) - One per cohort with clean page breaks */}
      <div className="space-y-8 print:space-y-0">
        {displayedGroups.map((group, groupIdx) => (
          <article
            key={group.cohortName}
            className={`rounded-xl border border-border bg-white p-6 shadow-xs print:border-0 print:p-0 print:shadow-none font-sans text-slate-900 ${
              groupIdx > 0 ? 'print:break-before-page' : ''
            }`}
            style={{ breakAfter: groupIdx < displayedGroups.length - 1 ? 'page' : 'auto' }}
          >
            {/* Header Block with Centered College Logo */}
            <div className="text-center">
              <div className="mb-2 flex justify-center">
                <Image
                  src="/branding/icmhs-logo.png"
                  alt="Imperial College of Medical and Health Sciences"
                  width={64}
                  height={64}
                  className="h-16 w-auto object-contain"
                  priority
                />
              </div>
              <h1 className="text-sm font-bold uppercase tracking-wide text-slate-900 sm:text-base">
                {institutionName}
              </h1>
              <h2 className="mt-0.5 text-sm font-black uppercase tracking-wider text-slate-900">
                {title}
              </h2>
              <p className="text-xs font-bold text-slate-800">
                {periodName}
              </p>
            </div>

            {/* Academic Details Block */}
            <div className="mt-3 space-y-1 text-xs border-b border-slate-900 pb-2">
              <p>
                <span className="font-bold">School:</span> {schoolName}
              </p>
              <p>
                <span className="font-bold">Department:</span> {departmentName}
              </p>
              <div className="flex items-center justify-between">
                <p>
                  <span className="font-bold">Cohort:</span> {group.cohortName}
                </p>
                <span className="text-[11px] font-bold text-slate-700">
                  {group.candidates.length} Candidates
                </span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span>Unit: {unitName} ({unitCode})</span>
                <span>Venue: {venueName || '—'}</span>
              </div>
            </div>

            {/* Attendance Register Table */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full table-fixed border-collapse border border-slate-900 text-left text-[11px]">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-36" />
                  <col />
                  {isExam ? <col className="w-32" /> : null}
                  <col className="w-32" />
                  <col className="w-20" />
                </colgroup>

                <thead>
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <th className="border border-slate-900 px-1.5 py-1 text-center">No.</th>
                    <th className="border border-slate-900 px-2 py-1">Adm No.</th>
                    <th className="border border-slate-900 px-2 py-1">Candidate Name</th>
                    {isExam ? (
                      <th className="border border-slate-900 px-2 py-1 text-center">Booklet No.</th>
                    ) : null}
                    <th className="border border-slate-900 px-2 py-1 text-center">Signature</th>
                    <th className="border border-slate-900 px-2 py-1 text-center">Marks</th>
                  </tr>
                </thead>

                <tbody>
                  {/* Candidate Rows for this Cohort */}
                  {group.candidates.map((cand, idx) => (
                    <tr key={cand.studentId} className="h-7">
                      <td className="border border-slate-900 px-1.5 py-0.5 text-center font-medium">
                        {idx + 1}.
                      </td>
                      <td className="border border-slate-900 px-2 py-0.5 font-semibold whitespace-nowrap">
                        {cand.admissionNumber}
                      </td>
                      <td className="border border-slate-900 px-2 py-0.5 font-bold uppercase truncate">
                        {cand.fullName}
                      </td>
                      {isExam ? (
                        <td className="border border-slate-900 p-0 text-center">
                          <div className="h-6 w-full" />
                        </td>
                      ) : null}
                      <td className="border border-slate-900 p-0 text-center">
                        <div className="h-6 w-full" />
                      </td>
                      <td className="border border-slate-900 p-0 text-center">
                        <div className="h-6 w-full" />
                      </td>
                    </tr>
                  ))}

                  {/* Blank Extra Rows for late adds */}
                  {Array.from({ length: blankRowsCount }, (_, i) => (
                    <tr key={`blank-${i}`} className="h-7">
                      <td className="border border-slate-900 px-1.5 py-0.5 text-center font-medium">
                        {group.candidates.length + i + 1}.
                      </td>
                      <td className="border border-slate-900 px-2 py-0.5 font-semibold">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 px-2 py-0.5">
                        &nbsp;
                      </td>
                      {isExam ? (
                        <td className="border border-slate-900 p-0 text-center">
                          <div className="h-6 w-full" />
                        </td>
                      ) : null}
                      <td className="border border-slate-900 p-0 text-center">
                        <div className="h-6 w-full" />
                      </td>
                      <td className="border border-slate-900 p-0 text-center">
                        <div className="h-6 w-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Script Count Summary (Exam) */}
            {isExam ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-slate-900 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900">
                <span>Total Registered Candidates: {group.candidates.length}</span>
                <span>Total Scripts Collected: ___________</span>
                <span>Total Absent Candidates: ___________</span>
              </div>
            ) : null}

            {/* Official Sign-off Footer - Full Width & Well-Spaced Layout */}
            <div className="mt-8 text-xs font-semibold text-slate-900 w-full">
              <div className="grid grid-cols-[110px_2fr_45px_1.2fr_45px_1fr] items-center gap-x-3 gap-y-5 w-full">
                {/* Row 1: Invigilator */}
                <span className="font-bold whitespace-nowrap">Invigilator:</span>
                <span className="border-b border-slate-900 h-5 w-full" />
                <span className="font-bold text-right whitespace-nowrap">Sign:</span>
                <span className="border-b border-slate-900 h-5 w-full" />
                <span className="font-bold text-right whitespace-nowrap">Date:</span>
                <span className="border-b border-slate-900 h-5 w-full" />

                {/* Row 2: Examiner */}
                <span className="font-bold whitespace-nowrap">Examiner:</span>
                <span className="border-b border-slate-900 h-5 w-full" />
                <span className="font-bold text-right whitespace-nowrap">Sign:</span>
                <span className="border-b border-slate-900 h-5 w-full" />
                <span className="font-bold text-right whitespace-nowrap">Date:</span>
                <span className="border-b border-slate-900 h-5 w-full" />

                {/* Row 3: Exam Officer */}
                <span className="font-bold whitespace-nowrap">Exam Officer:</span>
                <span className="border-b border-slate-900 h-5 w-full" />
                <span className="font-bold text-right whitespace-nowrap">Sign:</span>
                <span className="border-b border-slate-900 h-5 w-full" />
                <span className="font-bold text-right whitespace-nowrap">Date:</span>
                <span className="border-b border-slate-900 h-5 w-full" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
