'use client';

import {
  CalendarDays,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Printer,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { StaffUnitAllocation } from '@/features/staff-assessment/types';

interface StaffDownloadsViewProps {
  allocations: StaffUnitAllocation[];
  trainerName: string;
}

export function StaffDownloadsView({
  allocations,
}: StaffDownloadsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAllocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allocations;
    return allocations.filter(
      (a) =>
        a.unitCode.toLowerCase().includes(q) ||
        a.unitName.toLowerCase().includes(q) ||
        a.cohortName.toLowerCase().includes(q),
    );
  }, [allocations, searchQuery]);

  return (
    <div className="space-y-5 pb-12">
      {/* Top Shortcuts */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/staff/timetable"
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50/50"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <CalendarDays className="size-4" />
            </span>
            <div>
              <h2 className="text-xs font-bold text-slate-900">My Timetable</h2>
              <p className="text-[11px] text-slate-500">Weekly teaching schedule</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">View →</span>
        </Link>

        <Link
          href="/staff/documents"
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50/50"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <FileText className="size-4" />
            </span>
            <div>
              <h2 className="text-xs font-bold text-slate-900">Teaching Documents</h2>
              <p className="text-[11px] text-slate-500">Outlines, schemes & records</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">View →</span>
        </Link>
      </section>

      {/* Unit Attendance Registers Section */}
      <section className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Attendance & Signing Sheets
            </h2>
          </div>

          {/* Search Filter */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search units or cohorts..."
              className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Units List */}
        {filteredAllocations.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <FileSpreadsheet className="mx-auto size-7 text-slate-400" />
            <p className="mt-2 text-xs font-bold text-slate-700">No matching units</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAllocations.map((alloc) => (
              <article
                key={alloc.allocationId}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
              >
                {/* Unit Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                      {alloc.unitCode}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900">
                      {alloc.unitName}
                    </h3>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="text-[11px] text-slate-500">
                      {alloc.cohortName}
                    </span>
                  </div>

                  <Link
                    href={`/staff/units/${alloc.allocationId}`}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Open Unit →
                  </Link>
                </div>

                {/* 3 Registers */}
                <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                  {/* Class Attendance */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <UsersRound className="size-4 text-slate-600" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900">Class Attendance</p>
                        <p className="text-[10px] text-slate-400">Monthly roll</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/staff/units/${alloc.allocationId}/documents/class-attendance`}
                        className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Printer className="size-3" />
                        Print
                      </Link>
                      <a
                        href={`/api/staff/units/${alloc.allocationId}/attendance-sheet/class`}
                        className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        title="Download Word format"
                      >
                        <Download className="size-3" />
                        .docx
                      </a>
                    </div>
                  </div>

                  {/* CAT Attendance */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="size-4 text-slate-600" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900">CAT Attendance</p>
                        <p className="text-[10px] text-slate-400">Test register</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/staff/units/${alloc.allocationId}/documents/cat-attendance`}
                        className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Printer className="size-3" />
                        Print
                      </Link>
                      <a
                        href={`/api/staff/units/${alloc.allocationId}/attendance-sheet/cat`}
                        className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        title="Download Word format"
                      >
                        <Download className="size-3" />
                        .docx
                      </a>
                    </div>
                  </div>

                  {/* Exam Attendance */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="size-4 text-slate-600" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900">Exam Attendance</p>
                        <p className="text-[10px] text-slate-400">Scripts & register</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/staff/units/${alloc.allocationId}/documents/exam-attendance`}
                        className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Printer className="size-3" />
                        Print
                      </Link>
                      <a
                        href={`/api/staff/units/${alloc.allocationId}/attendance-sheet/exam`}
                        className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        title="Download Word format"
                      >
                        <Download className="size-3" />
                        .docx
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
