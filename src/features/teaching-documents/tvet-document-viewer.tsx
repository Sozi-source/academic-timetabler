'use client';

import Image from 'next/image';
import { ArrowLeft, FileDown, Pencil, Printer } from 'lucide-react';
import Link from 'next/link';
import type {
  TVETCourseOutlineData,
  TVETRecordOfWorkData,
  TVETSchemeOfWorkData,
} from './tvet-standards';

interface ViewerProps {
  type: 'course_outline' | 'scheme_of_work' | 'record_of_work';
  allocationId: string;
  courseOutline?: TVETCourseOutlineData;
  schemeOfWork?: TVETSchemeOfWorkData;
  recordOfWork?: TVETRecordOfWorkData;
}

export function TVETDocumentViewer({
  type,
  allocationId,
  courseOutline,
  schemeOfWork,
  recordOfWork,
}: ViewerProps) {
  const header =
    courseOutline?.header ??
    schemeOfWork?.header ??
    recordOfWork?.header;

  if (!header) {
    return <div className="p-4 text-sm text-slate-600">Document details unavailable.</div>;
  }

  const title =
    type === 'course_outline'
      ? 'COURSE OUTLINE'
      : type === 'scheme_of_work'
        ? 'SCHEME OF WORK'
        : 'RECORD OF WORK COVERED';

  const handleExportWord = async () => {
    try {
      const res = await fetch(
        `/api/teaching-documents/export-word?allocationId=${allocationId}&type=${type}`,
      );
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${header.unitCode}_${type}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Word export is not available yet for this document.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* Top Action Bar (Hidden during printing) */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4 print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/staff/units/${allocationId}/documents`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back
          </Link>
          <span className="min-w-0 truncate text-xs font-bold text-slate-900">
            {header.unitCode} · {header.unitName}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          {type !== 'record_of_work' && (
            <Link
              href={`/teaching-documents/curriculum/editor?unitCode=${encodeURIComponent(header.unitCode)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Pencil className="size-3.5 text-slate-600" aria-hidden="true" />
              <span className="sm:hidden">Edit</span>
              <span className="hidden sm:inline">Edit Course Outline</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Printer className="size-4 text-slate-600" aria-hidden="true" />
            <span className="sm:hidden">Print</span>
            <span className="hidden sm:inline">Print Preview</span>
          </button>

          <button
            type="button"
            onClick={handleExportWord}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
          >
            <FileDown className="size-4" aria-hidden="true" />
            <span className="sm:hidden">Word</span>
            <span className="hidden sm:inline">Export Word (.docx)</span>
          </button>
        </div>
      </div>

      {/* Printable Document Container (Professional Academic Layout) */}
      <div className="mx-auto min-w-0 max-w-5xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md print:m-0 print:max-w-none print:overflow-visible print:border-none print:shadow-none">

        {/* ── OFFICIAL ACADEMIC HEADER ── */}
        <div className="border-b-2 border-slate-900 bg-white px-4 py-5 text-center sm:px-8 sm:py-6 print:px-6 print:py-4">
          <div className="mx-auto flex flex-col items-center justify-center space-y-2">
            {/* Official Center Crest / Logo Emblem */}
            <div className="mb-1 flex items-center justify-center">
              <Image
                src="/branding/icmhs-logo.png"
                alt="Imperial College Logo"
                width={80}
                height={80}
                priority
                className="h-16 w-auto object-contain mx-auto print:h-14"
              />
            </div>

            {/* Institution & Department */}
            <div>
              <h1 className="text-base font-black tracking-wide text-slate-900 uppercase sm:text-2xl sm:tracking-wider print:text-black">
                {header.institutionName}
              </h1>
              <p className="mt-0.5 text-xs font-bold tracking-widest text-slate-700 uppercase print:text-black">
                Department of {header.departmentName}
              </p>
              <div className="mt-2.5 inline-block rounded-md border-2 border-slate-900 bg-slate-100 px-4 py-0.5 text-[11px] font-black tracking-widest text-slate-900 uppercase print:border-black print:bg-slate-100 print:text-black">
                {title}
              </div>
            </div>
          </div>
        </div>

        {/* ── CONSPICUOUS UNIT NAME BANNER ── */}
        <div className="border-b-2 border-slate-900 bg-slate-100 px-4 py-3 text-center sm:px-8 sm:py-3.5 print:bg-slate-50 print:border-black">
          <p className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">Curriculum Unit</p>
          <h2 className="text-sm font-black tracking-wide text-slate-900 uppercase sm:text-xl print:text-black">
            {header.unitCode} — {header.unitName}
          </h2>
        </div>

        {/* ── CONTEXT MATRIX (HIGH-CONTRAST MONOCHROME-SAFE GRID) ── */}
        <div className="grid grid-cols-2 gap-0 border-b-2 border-slate-900 bg-slate-50 text-xs sm:grid-cols-4 print:border-black">
          {[
            { label: 'Cohort / Class', value: header.cohortName },
            { label: 'Trainer', value: header.trainerName },
            { label: 'Academic Period', value: header.academicPeriodName },
            { label: 'Contact Hours', value: `${header.weeklyHours} hrs/wk · ${header.totalNominalHours} hrs total` },
            { label: 'Standard Status', value: 'APPROVED', highlight: true },
            { label: 'Delivery Duration', value: '14 Weeks' },
            { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
            { label: 'Document Type', value: title },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="min-w-0 border-r border-b border-slate-300 px-3 py-2 sm:px-4 sm:py-2.5 last:border-r-0 print:border-slate-800">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
              <span className={`mt-0.5 block font-bold ${highlight ? 'text-slate-900 font-black' : 'text-slate-900'}`}>{value}</span>
            </div>
          ))}
        </div>

        <div className="p-3 sm:p-8 print:p-6">

          {/* ════════════════════════════════ COURSE OUTLINE ════════════════════════════════ */}
          {type === 'course_outline' && courseOutline && (
            <div className="space-y-6 text-xs text-slate-900">

              <section>
                <SectionHeading number="1" title="Unit Description & Overall Purpose" />
                <p className="mt-2.5 leading-relaxed text-justify text-slate-800">
                  {courseOutline.unitDescription || '—'}
                </p>
              </section>

              <section>
                <SectionHeading number="2" title="Summary of Learning Outcomes (Core Competencies)" />
                <ul className="mt-2.5 space-y-1.5 text-slate-800">
                  {courseOutline.learningOutcomes.map((lo, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 mt-0.5 flex size-4 items-center justify-center rounded border border-slate-900 bg-slate-100 text-[10px] font-black text-slate-900">{i + 1}</span>
                      <span className="leading-relaxed">{lo}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <SectionHeading number="3" title="Weekly Delivery & Topical Breakdown" />
                <div className="mt-3 overflow-x-auto overscroll-x-contain rounded border border-slate-300 print:overflow-visible">
                <table className="w-full min-w-[44rem] border-collapse text-[11px] table-fixed print:min-w-0">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-900">
                      <th className="border border-slate-300 px-2 py-2 text-center w-[8%] font-black uppercase text-[9px] tracking-wider text-slate-900">Week</th>
                      <th className="border border-slate-300 px-3 py-2 text-left w-[32%] font-black uppercase text-[9px] tracking-wider text-slate-900">Topic Title</th>
                      <th className="border border-slate-300 px-3 py-2 text-left w-[52%] font-black uppercase text-[9px] tracking-wider text-slate-900">Content / Sub-topics to be Covered</th>
                      <th className="border border-slate-300 px-2 py-2 text-center w-[8%] font-black uppercase text-[9px] tracking-wider text-slate-900">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseOutline.weeklySchedule.map((sched, idx) => {
                      const allSubtopics = sched.subTopics.flatMap((st) =>
                        typeof st === 'string' ? st.split(/\s*[·;]\s*/).filter(Boolean) : []
                      );

                      return (
                        <tr key={sched.weekNumber} className={idx % 2 === 0 ? 'bg-white align-top' : 'bg-slate-50 align-top'}>
                          <td className="border border-slate-300 px-2 py-2 text-center font-black text-slate-900">
                            W{sched.weekNumber}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 font-bold text-slate-900 leading-snug">
                            {sched.topicTitle}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-slate-800 leading-relaxed">
                            {allSubtopics.length > 0 ? (
                              <ul className="space-y-1">
                                {allSubtopics.map((sub, sIdx) => (
                                  <li key={sIdx} className="flex items-start gap-1.5">
                                    <span className="shrink-0 text-slate-900 font-bold">•</span>
                                    <span>{sub.trim()}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-slate-400 italic">Core topic mastery and practical coverage.</span>
                            )}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-800">
                            {sched.hours} hrs
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </section>

              {(courseOutline.teachingLearningApproaches || courseOutline.assessmentApproaches) && (
                <section>
                  <SectionHeading number="4" title="Teaching / Learning and Assessment Approaches" />
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
                      <p className="font-black text-slate-900 text-[11px] mb-1.5">Teaching / Learning Approaches</p>
                      <p className="text-slate-800 leading-relaxed">{courseOutline.teachingLearningApproaches || 'Interactive lectures, guided class discussions, practical demonstrations, and small-group problem-solving.'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
                      <p className="font-black text-slate-900 text-[11px] mb-1.5">Assessment Approaches & Weighting</p>
                      <ul className="space-y-1 text-slate-800">
                        {(courseOutline.assessmentApproaches || '')
                          .split(/\n+/)
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .map((line, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="shrink-0 text-slate-900 font-bold">•</span>
                              <span>{line}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </section>
              )}

              <section>
                <SectionHeading number="5" title="Instructional Resources & References" />
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-black text-slate-900 text-[11px] mb-1">References</p>
                    {courseOutline.references.length === 0 ? (
                      <p className="text-slate-600 italic leading-relaxed">Course Textbooks & Handouts as prescribed by the Department.</p>
                    ) : (
                      <ul className="space-y-1 text-slate-800">
                        {courseOutline.references.map((r, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span className="shrink-0 text-slate-900 font-bold">{i + 1}.</span>
                            <span>{r.replace(/^\d+\.\s*/, '')}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-[11px] mb-1">Equipment & Safety Materials</p>
                    {courseOutline.instructionalEquipment.length === 0 ? (
                      <p className="text-slate-600 italic leading-relaxed">Whiteboard & Markers, Demonstration Aids & Standard Safety Gear.</p>
                    ) : (
                      <ul className="space-y-1 text-slate-800">
                        {courseOutline.instructionalEquipment.map((e, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span className="shrink-0 text-slate-900 font-bold">{i + 1}.</span>
                            <span>{e.replace(/^\d+\.\s*/, '')}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ════════════════════════════════ SCHEME OF WORK ════════════════════════════════ */}
          {type === 'scheme_of_work' && schemeOfWork && (
            <div className="space-y-4">
              <div className="overflow-x-auto overscroll-x-contain rounded border border-slate-300 print:overflow-visible">
              <table className="w-full min-w-[52rem] border-collapse text-[10px] table-fixed print:min-w-0">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-900">
                    <th className="border border-slate-300 px-2 py-2 text-center w-[5%] font-black uppercase text-[9px] tracking-wider text-slate-900">Wk</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-left w-[25%] font-black uppercase text-[9px] tracking-wider text-slate-900">Topic & Sub-topics</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-left w-[40%] font-black uppercase text-[9px] tracking-wider text-slate-900">Specific Learning Outcomes (SLOs)</th>
                    <th className="border border-slate-300 px-2 py-2 text-left w-[16%] font-black uppercase text-[9px] tracking-wider text-slate-900">Activities & Methodology</th>
                    <th className="border border-slate-300 px-2 py-2 text-left w-[14%] font-black uppercase text-[9px] tracking-wider text-slate-900">Instructional Resources</th>
                  </tr>
                </thead>
                <tbody>
                  {schemeOfWork.plannedWeeks.map((w, idx) => (
                    <tr key={w.weekNumber} className={idx % 2 === 0 ? 'bg-white align-top' : 'bg-slate-50 align-top'}>
                      <td className="border border-slate-300 px-2 py-2 text-center font-black text-slate-900">
                        {w.weekNumber}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2">
                        <div className="font-bold text-slate-900 leading-snug">{w.topic}</div>
                        {w.subTopics && (
                          <div className="mt-1 text-[9px] text-slate-600 leading-relaxed">{w.subTopics}</div>
                        )}
                      </td>
                      {/* SLOs: individual bullets on separate lines with clean line-height */}
                      <td className="border border-slate-300 px-2.5 py-2 text-slate-800 leading-relaxed">
                        <SLOBullets text={w.specificLearningOutcomes} />
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-800 leading-relaxed">
                        {w.learningActivities}
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-800 leading-relaxed">
                        {w.resourcesAndReferences}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════ RECORD OF WORK ════════════════════════════════ */}
          {type === 'record_of_work' && recordOfWork && (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 text-xs">
                <span className="font-bold text-slate-700">
                  Progress: <strong className="text-slate-900">{recordOfWork.completedWeeksCount} of {recordOfWork.totalPlannedWeeks} Weeks Delivered</strong>
                </span>
                <span className="font-black text-slate-900">
                  {recordOfWork.syllabusCompletionRate}% Delivered
                </span>
              </div>

              <div className="overflow-x-auto overscroll-x-contain rounded border border-slate-300 print:overflow-visible">
              <table className="w-full min-w-[52rem] border-collapse text-[10px] table-fixed print:min-w-0">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-900">
                    <th className="border border-slate-300 px-2 py-2 text-center w-[5%] font-black uppercase text-[9px] tracking-wider text-slate-900">Wk</th>
                    <th className="border border-slate-300 px-2 py-2 w-[12%] font-black uppercase text-[9px] tracking-wider text-slate-900">Date</th>
                    <th className="border border-slate-300 px-2 py-2 w-[28%] font-black uppercase text-[9px] tracking-wider text-slate-900">Work Covered / Activities</th>
                    <th className="border border-slate-300 px-2 py-2 w-[28%] font-black uppercase text-[9px] tracking-wider text-slate-900">Specific Outcomes Achieved</th>
                    <th className="border border-slate-300 px-2 py-2 w-[11%] font-black uppercase text-[9px] tracking-wider text-slate-900">Attendance</th>
                    <th className="border border-slate-300 px-2 py-2 w-[10%] font-black uppercase text-[9px] tracking-wider text-slate-900">Remarks</th>
                    <th className="border border-slate-300 px-2 py-2 w-[6%] text-center font-black uppercase text-[9px] tracking-wider text-slate-900">Sign</th>
                  </tr>
                </thead>
                <tbody>
                  {recordOfWork.entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                        No entries logged yet.
                      </td>
                    </tr>
                  ) : (
                    recordOfWork.entries.map((entry, idx) => (
                      <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white align-top' : 'bg-slate-50 align-top'}>
                        <td className="border border-slate-300 px-2 py-2 text-center font-black text-slate-900 print:border-slate-800">
                          W{entry.weekNumber}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 font-medium text-slate-700 whitespace-nowrap print:border-slate-800">
                          {entry.sessionDate}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 font-bold text-slate-900 leading-relaxed print:border-slate-800">
                          {entry.workCovered}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-slate-800 leading-relaxed print:border-slate-800">
                          {entry.outcomesAchieved}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-slate-700 print:border-slate-800">
                          {entry.attendanceSummary}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-slate-600 text-[9px] leading-relaxed print:border-slate-800">
                          {entry.remarks}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-center font-bold text-[9px] text-slate-900 print:border-slate-800">
                          {entry.trainerSignature.split(' ')[0] || 'Signed'}
                          <div className="text-[8px] text-slate-500">{new Date(entry.signedAt).toLocaleDateString('en-GB')}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* ── INSTITUTIONAL SIGN-OFF BLOCK ── */}
          <div className="mt-10 border-t-2 border-slate-900 pt-6 text-xs print:border-black">
            <div className="grid gap-8 sm:grid-cols-3">
              {[
                { role: 'Trainer Sign-off', name: header.trainerName },
                { role: 'Head of Department (HOD)', name: 'Signature & Official Stamp' },
                { role: 'Quality Assurance Verification', name: 'Institutional Audit Stamp' },
              ].map(({ role, name }) => (
                <div key={role}>
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-900">{role}</p>
                  <div className="mt-8 border-b-2 border-slate-900 print:border-black" />
                  <p className="mt-1 font-bold text-slate-800">{name}</p>
                  <p className="text-[10px] text-slate-500">Date: ________________________</p>
                </div>
              ))}
            </div>
          </div>

        </div>{/* /p-8 */}
      </div>
    </div>
  );
}

/** Styled section heading used across Course Outline sections */
function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-1.5 print:border-black">
      <span className="flex size-5 shrink-0 items-center justify-center rounded border border-slate-900 bg-slate-100 text-[10px] font-black text-slate-900">
        {number}
      </span>
      <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-900 print:text-black">{title}</h2>
    </div>
  );
}

/**
 * Renders a Specific Learning Outcomes string as individual bullet lines.
 * Splits on newline characters produced by synthesizeLearningObjectives.
 */
export function SLOBullets({ text }: { text: string }) {
  if (!text) return <span className="text-slate-400">—</span>;

  // Split on newline or bullet symbols
  const rawLines = text.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  if (rawLines.length <= 1) {
    // If it's a single string with inline bullets
    const inlineParts = text.split(/[•·]+/).map((p) => p.trim()).filter(Boolean);
    if (inlineParts.length > 1) {
      const [preamble, ...bullets] = inlineParts;
      return (
        <div className="space-y-1">
          <p className="text-[9px] italic text-slate-600 leading-tight">{preamble}</p>
          <ul className="space-y-1">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-1 leading-snug">
                <span className="shrink-0 mt-[2px] text-slate-900 font-black text-[10px]">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return <span className="leading-relaxed">{text}</span>;
  }

  const [preamble, ...bullets] = rawLines;
  return (
    <div className="space-y-1">
      <p className="text-[9px] italic text-slate-600 leading-tight">{preamble}</p>
      <ul className="space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-1 leading-snug">
            <span className="shrink-0 mt-[2px] text-slate-900 font-black text-[10px]">•</span>
            <span>{b.replace(/^[•·\s-]+/, '')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
