'use client';

import { ArrowLeft, Download, Printer } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface CandidateItem {
  studentId: string;
  admissionNumber: string;
  fullName: string;
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
  const isExam = type === 'exam';
  const title = isExam
    ? 'FINAL EXAMINATION ATTENDANCE & SCRIPT REGISTER'
    : 'CONTINUOUS ASSESSMENT TEST (CAT) ATTENDANCE LIST';

  // 4 blank rows for late add-ons
  const blankRowsCount = 4;

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

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover"
          >
            <Printer className="size-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Official Printable Sheet */}
      <article className="rounded-xl border border-border bg-white p-6 shadow-xs print:border-0 print:p-0 print:shadow-none font-sans text-slate-900">
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
          <p>
            <span className="font-bold">Cohort:</span> {cohortName}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
            <span>Unit: {unitName} ({unitCode})</span>
            <span>Trainer: {trainerName}</span>
            <span>Venue: {venueName || '—'}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-0.5 text-[11px] font-semibold text-slate-700">
            <span>Date of Assessment: _____________________</span>
            <span>Time / Session: _____________________</span>
            {isExam ? (
              <span>Max Marks: <strong>70%</strong></span>
            ) : (
              <span>Max Marks: <strong>15%</strong></span>
            )}
          </div>
        </div>

        {/* Candidate Register Table */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full table-fixed border-collapse border border-slate-900 text-left text-[10.5px]">
            <colgroup>
              <col className="w-9" />
              <col className="w-36" />
              <col />
              {isExam ? <col className="w-40" /> : null}
              <col className="w-40" />
              <col className="w-20" />
            </colgroup>

            <thead>
              <tr className="bg-slate-100 font-bold text-slate-900">
                <th className="border border-slate-900 px-1.5 py-1.5 text-center">No.</th>
                <th className="border border-slate-900 px-2 py-1.5">Adm No.</th>
                <th className="border border-slate-900 px-2 py-1.5">Candidate Name</th>
                {isExam ? (
                  <th className="border border-slate-900 px-1.5 py-1.5 text-center">
                    Booklet Serial Number
                  </th>
                ) : null}
                <th className="border border-slate-900 px-2 py-1.5 text-center">
                  Candidate Signature
                </th>
                <th className="border border-slate-900 px-1 py-1.5 text-center">
                  Marks
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Registered Student Rows */}
              {candidates.map((candidate, idx) => (
                <tr key={candidate.studentId} className="h-6">
                  <td className="border border-slate-900 px-1.5 py-0.5 text-center font-medium">
                    {idx + 1}.
                  </td>
                  <td className="border border-slate-900 px-2 py-0.5 font-semibold whitespace-nowrap">
                    {candidate.admissionNumber}
                  </td>
                  <td className="border border-slate-900 px-2 py-0.5 font-bold uppercase truncate">
                    {candidate.fullName}
                  </td>
                  {isExam ? (
                    <td className="border border-slate-900 p-0 text-center">
                      <div className="h-5 w-full" />
                    </td>
                  ) : null}
                  <td className="border border-slate-900 p-0 text-center">
                    <div className="h-5 w-full" />
                  </td>
                  <td className="border border-slate-900 p-0 text-center">
                    <div className="h-5 w-full" />
                  </td>
                </tr>
              ))}

              {/* Blank Extra Rows for late adds */}
              {Array.from({ length: blankRowsCount }, (_, i) => (
                <tr key={`blank-${i}`} className="h-6">
                  <td className="border border-slate-900 px-1.5 py-0.5 text-center font-medium">
                    {candidates.length + i + 1}.
                  </td>
                  <td className="border border-slate-900 px-2 py-0.5 font-semibold">
                    &nbsp;
                  </td>
                  <td className="border border-slate-900 px-2 py-0.5">
                    &nbsp;
                  </td>
                  {isExam ? (
                    <td className="border border-slate-900 p-0 text-center">
                      <div className="h-5 w-full" />
                    </td>
                  ) : null}
                  <td className="border border-slate-900 p-0 text-center">
                    <div className="h-5 w-full" />
                  </td>
                  <td className="border border-slate-900 p-0 text-center">
                    <div className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Script Count Summary (Exam) */}
        {isExam ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-slate-900 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900">
            <span>Total Registered Candidates: {candidates.length}</span>
            <span>Total Scripts Collected: ___________</span>
            <span>Total Absent Candidates: ___________</span>
          </div>
        ) : null}

        {/* Official Sign-off Footer: Invigilator, Examiner, Exam Officer (Name, Sign, Date) */}
        <div className="mt-8 text-xs font-semibold text-slate-900">
          <div className="grid grid-cols-[100px_1.5fr_40px_1fr_40px_100px] items-center gap-x-2 gap-y-3.5">
            {/* Row 1: Invigilator */}
            <span className="font-bold whitespace-nowrap">Invigilator:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Sign:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Date:</span>
            <span className="border-b border-slate-900 h-4 w-full" />

            {/* Row 2: Examiner */}
            <span className="font-bold whitespace-nowrap">Examiner:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Sign:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Date:</span>
            <span className="border-b border-slate-900 h-4 w-full" />

            {/* Row 3: Exam Officer */}
            <span className="font-bold whitespace-nowrap">Exam Officer:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Sign:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Date:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
          </div>
        </div>
      </article>
    </div>
  );
}
