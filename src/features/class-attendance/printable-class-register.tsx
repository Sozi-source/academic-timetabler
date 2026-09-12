'use client';

import { ArrowLeft, Download, Printer } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface StudentItem {
  studentId: string;
  admissionNumber: string;
  fullName: string;
}

interface ClassRegisterProps {
  allocationId: string;
  unitCode: string;
  unitName: string;
  cohortName: string;
  periodName: string;
  trainerName: string;
  schoolName?: string;
  departmentName?: string;
  programmeName?: string;
  venueName?: string;
  students: StudentItem[];
}

export function PrintableClassRegister({
  allocationId,
  unitCode,
  unitName,
  cohortName,
  periodName,
  trainerName,
  schoolName = 'Imperial',
  departmentName = 'Applied Science',
  programmeName = 'Diploma in Science Laboratory Technology',
  venueName,
  students,
}: ClassRegisterProps) {
  // Allow lecturer to toggle monthly session count (default: 8 sessions/month for 2 sessions/wk)
  const [sessionCount, setSessionCount] = useState<number>(8);

  // Add 4 blank rows at the end for manual add-ons
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

        {/* Dynamic Monthly Sessions Selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-text-muted">Monthly Sessions:</span>
          <div className="flex items-center gap-1">
            {[4, 6, 8, 10, 12, 14, 16].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setSessionCount(count)}
                className={`h-7 rounded-md px-2 text-xs font-bold transition ${
                  sessionCount === count
                    ? 'bg-primary text-white shadow-xs'
                    : 'border border-border bg-surface-subtle text-text-secondary hover:bg-surface'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/staff/units/${allocationId}/attendance-sheet/class`}
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
            Imperial College of Medical and Health Sciences
          </h1>
          <h2 className="mt-0.5 text-sm font-black uppercase tracking-wider text-slate-900">
            CLASS ATTENDANCE LIST
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
          <div className="flex items-center justify-between font-bold">
            <span>Unit: {unitName} ({unitCode})</span>
            <span>Venue: {venueName || '—'}</span>
          </div>
        </div>

        {/* Attendance Register Table with Balanced Column Layout */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full table-fixed border-collapse border border-slate-900 text-left text-[10.5px]">
            <colgroup>
              <col className="w-9" />
              <col className="w-32" />
              <col className="w-48" />
              {Array.from({ length: sessionCount }, (_, i) => (
                <col key={i} />
              ))}
            </colgroup>

            <thead>
              {/* DATES Header Row */}
              <tr className="bg-slate-50 font-bold text-slate-900">
                <th colSpan={3} className="border border-slate-900 px-2 py-1 uppercase text-center tracking-wider">
                  DATES
                </th>
                {Array.from({ length: sessionCount }, (_, i) => (
                  <th
                    key={i}
                    className="border border-slate-900 px-0.5 py-1 text-center text-[9px]"
                  >
                    &nbsp;
                  </th>
                ))}
              </tr>

              {/* Column Titles */}
              <tr className="bg-slate-100 font-bold text-slate-900">
                <th className="border border-slate-900 px-1 py-1 text-center">No.</th>
                <th className="border border-slate-900 px-2 py-1">Adm No.</th>
                <th className="border border-slate-900 px-2 py-1">Name</th>
                {Array.from({ length: sessionCount }, (_, i) => (
                  <th
                    key={i}
                    className="border border-slate-900 px-1 py-1 text-center font-bold"
                  >
                    Sign
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Registered Student Rows */}
              {students.map((student, idx) => (
                <tr key={student.studentId} className="h-6">
                  <td className="border border-slate-900 px-1 py-0.5 text-center font-medium">
                    {idx + 1}.
                  </td>
                  <td className="border border-slate-900 px-2 py-0.5 font-semibold whitespace-nowrap">
                    {student.admissionNumber}
                  </td>
                  <td className="border border-slate-900 px-2 py-0.5 font-bold uppercase truncate">
                    {student.fullName}
                  </td>
                  {Array.from({ length: sessionCount }, (_, i) => (
                    <td
                      key={i}
                      className="border border-slate-900 p-0 text-center"
                    >
                      <div className="h-5 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

              {/* Blank Extra Rows for late adds */}
              {Array.from({ length: blankRowsCount }, (_, i) => (
                <tr key={`blank-${i}`} className="h-6">
                  <td className="border border-slate-900 px-1 py-0.5 text-center font-medium">
                    {students.length + i + 1}.
                  </td>
                  <td className="border border-slate-900 px-2 py-0.5 font-semibold">
                    &nbsp;
                  </td>
                  <td className="border border-slate-900 px-2 py-0.5">
                    &nbsp;
                  </td>
                  {Array.from({ length: sessionCount }, (_, s) => (
                    <td
                      key={s}
                      className="border border-slate-900 p-0 text-center"
                    >
                      <div className="h-5 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Official Sign-off Footer with Perfectly Aligned Straight Columns */}
        <div className="mt-8 text-xs font-semibold text-slate-900">
          <div className="grid grid-cols-[145px_1fr_65px_1.8fr_40px_90px] items-center gap-x-2 gap-y-3.5">
            {/* Row 1: Class Representative */}
            <span className="font-bold whitespace-nowrap">Class Representative:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Comment:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Sign:</span>
            <span className="border-b border-slate-900 h-4 w-full" />

            {/* Row 2: Trainer */}
            <span className="font-bold whitespace-nowrap">Trainer:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Comment:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Sign:</span>
            <span className="border-b border-slate-900 h-4 w-full" />

            {/* Row 3: HOD */}
            <span className="font-bold whitespace-nowrap">HOD:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Comment:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
            <span className="font-bold text-right">Sign:</span>
            <span className="border-b border-slate-900 h-4 w-full" />
          </div>
        </div>
      </article>
    </div>
  );
}
