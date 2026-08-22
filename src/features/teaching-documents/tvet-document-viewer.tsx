'use client';

import { ArrowLeft, CheckCircle, Clock, FileText, Printer } from 'lucide-react';
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
    return <div>Document details unavailable.</div>;
  }

  const title =
    type === 'course_outline'
      ? 'STANDARD COURSE OUTLINE'
      : type === 'scheme_of_work'
        ? 'STANDARD SCHEME OF WORK / LESSON PLAN'
        : 'STANDARD RECORD OF WORK COVERED';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden during printing) */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Link
            href={`/staff/units/${allocationId}/documents`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Documents
          </Link>
          <span className="text-xs font-bold text-text-primary">
            {header.unitCode} · {header.unitName}
          </span>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-white shadow-sm transition hover:bg-primary-hover"
        >
          <Printer className="size-4" aria-hidden="true" />
          Print / Export Document
        </button>
      </div>

      {/* Printable Document Container */}
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-white p-8 shadow-sm print:m-0 print:max-w-none print:border-none print:p-0 print:shadow-none">
        {/* Official Header Block */}
        <div className="border-b-2 border-text-primary pb-4 text-center">
          <h1 className="mt-1 text-lg font-black tracking-wide text-text-primary uppercase sm:text-xl">
            {header.institutionName}
          </h1>
          <p className="text-xs font-semibold text-text-secondary">
            DEPARTMENT OF {header.departmentName.toUpperCase()}
          </p>
          <div className="mt-2 inline-block rounded border border-text-primary px-3 py-1 text-xs font-extrabold tracking-wider uppercase">
            {title}
          </div>
        </div>

        {/* Dynamic Context Matrix */}
        <div className="mt-4 grid grid-cols-2 gap-2 border border-text-primary bg-surface-subtle p-3 text-xs font-medium sm:grid-cols-4">
          <div>
            <span className="font-bold text-text-muted uppercase text-[10px] block">Unit Code & Title:</span>
            <span className="font-bold text-text-primary">{header.unitCode} - {header.unitName}</span>
          </div>
          <div>
            <span className="font-bold text-text-muted uppercase text-[10px] block">Cohort / Class:</span>
            <span className="font-bold text-text-primary">{header.cohortName}</span>
          </div>
          <div>
            <span className="font-bold text-text-muted uppercase text-[10px] block">Trainer Name:</span>
            <span className="font-bold text-text-primary">{header.trainerName}</span>
          </div>
          <div>
            <span className="font-bold text-text-muted uppercase text-[10px] block">Academic Period:</span>
            <span className="font-bold text-text-primary">{header.academicPeriodName}</span>
          </div>
          <div>
            <span className="font-bold text-text-muted uppercase text-[10px] block">Weekly Contact Hours:</span>
            <span className="font-bold text-text-primary">{header.weeklyHours} Hours / Week</span>
          </div>
          <div>
            <span className="font-bold text-text-muted uppercase text-[10px] block">Total Nominal Hours:</span>
            <span className="font-bold text-text-primary">{header.totalNominalHours} Hours (14 Weeks)</span>
          </div>
          <div>
            <span className="font-bold text-text-muted uppercase text-[10px] block">Standard Status:</span>
            <span className="font-bold text-success uppercase">APPROVED</span>
          </div>
          <div>
            <span className="font-bold text-text-muted uppercase text-[10px] block">Generated Date:</span>
            <span className="font-bold text-text-primary">{new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        {/* DOCUMENT TYPE 1: COURSE OUTLINE */}
        {type === 'course_outline' && courseOutline && (
          <div className="mt-6 space-y-5 text-xs text-text-primary">
            <section>
              <h2 className="border-b border-border pb-1 font-bold uppercase tracking-wider text-text-primary">
                1. Unit Description & Overall Purpose
              </h2>
              <p className="mt-2 text-justify leading-relaxed text-text-secondary">
                {courseOutline.unitDescription}
              </p>
            </section>

            <section>
              <h2 className="border-b border-border pb-1 font-bold uppercase tracking-wider text-text-primary">
                2. Summary of Learning Outcomes (Core Competencies)
              </h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-text-secondary">
                {courseOutline.learningOutcomes.map((lo, i) => (
                  <li key={i}>{lo}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="border-b border-border pb-1 font-bold uppercase tracking-wider text-text-primary">
                3. Weekly Delivery & Topical Breakdown
              </h2>
              <table className="mt-2 w-full border-collapse border border-text-primary text-left text-[11px]">
                <thead>
                  <tr className="border-b border-text-primary bg-surface-subtle font-bold uppercase">
                    <th className="border-r border-text-primary p-2 w-16 text-center">Week</th>
                    <th className="border-r border-text-primary p-2">Topic & Specific Coverage</th>
                    <th className="p-2 w-20 text-center">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {courseOutline.weeklySchedule.map((sched) => (
                    <tr key={sched.weekNumber} className="border-b border-border">
                      <td className="border-r border-text-primary p-2 text-center font-bold">
                        W{sched.weekNumber}
                      </td>
                      <td className="border-r border-text-primary p-2">
                        <div className="font-bold text-text-primary">{sched.topicTitle}</div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {sched.subTopics.join(' · ')}
                        </div>
                      </td>
                      <td className="p-2 text-center font-medium">{sched.hours} hrs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {(courseOutline.teachingLearningApproaches || courseOutline.assessmentApproaches) ? (
              <section>
                <h2 className="border-b border-border pb-1 font-bold uppercase tracking-wider text-text-primary">
                  4. Teaching / Learning and Assessment Approaches
                </h2>
                <div className="mt-2 grid gap-4 sm:grid-cols-2 text-text-secondary">
                  <div>
                    <p className="font-bold text-text-primary text-[11px]">Teaching / Learning Approaches</p>
                    <p className="mt-1 leading-relaxed">{courseOutline.teachingLearningApproaches || '—'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-text-primary text-[11px]">Assessment Approaches</p>
                    <p className="mt-1 leading-relaxed">{courseOutline.assessmentApproaches || '—'}</p>
                  </div>
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="border-b border-border pb-1 font-bold uppercase tracking-wider text-text-primary">
                5. Instructional Resources & References
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-4 text-text-secondary">
                <div>
                  <p className="font-bold text-text-primary text-[11px]">References:</p>
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    {courseOutline.references.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-text-primary text-[11px]">Equipment & Safety Materials:</p>
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    {courseOutline.instructionalEquipment.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* DOCUMENT TYPE 2: SCHEME OF WORK */}
        {type === 'scheme_of_work' && schemeOfWork && (
          <div className="mt-6 space-y-4">
            <table className="w-full border-collapse border border-text-primary text-left text-[10px]">
              <thead>
                <tr className="border-b border-text-primary bg-surface-subtle font-bold uppercase">
                  <th className="border-r border-text-primary p-2 w-12 text-center">Wk</th>
                  <th className="border-r border-text-primary p-2 w-44">Topic & Sub-topics</th>
                  <th className="border-r border-text-primary p-2">Specific Learning Outcomes (SLOs)</th>
                  <th className="border-r border-text-primary p-2 w-40">Activities & Methodology</th>
                  <th className="border-r border-text-primary p-2 w-36">Resources & References</th>
                  <th className="p-2 w-32">Assessment / Learning Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schemeOfWork.plannedWeeks.map((w) => (
                  <tr key={w.weekNumber} className="border-b border-border">
                    <td className="border-r border-text-primary p-2 text-center font-bold">
                      {w.weekNumber}
                    </td>
                    <td className="border-r border-text-primary p-2">
                      <div className="font-bold text-text-primary">{w.topic}</div>
                      <div className="text-[9px] text-text-muted mt-0.5">{w.subTopics}</div>
                    </td>
                    <td className="border-r border-text-primary p-2 text-text-secondary">
                      {w.specificLearningOutcomes}
                    </td>
                    <td className="border-r border-text-primary p-2 text-text-secondary">
                      {w.learningActivities}
                    </td>
                    <td className="border-r border-text-primary p-2 text-text-secondary">
                      {w.resourcesAndReferences}
                    </td>
                    <td className="p-2 text-text-secondary font-medium">
                      {w.assessmentAndRemarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DOCUMENT TYPE 3: RECORD OF WORK */}
        {type === 'record_of_work' && recordOfWork && (
          <div className="mt-6 space-y-5">
            {/* Progress Badge */}
            <div className="flex items-center justify-between border border-border bg-surface-subtle p-3 text-xs">
              <span className="font-semibold text-text-secondary">
                Syllabus Progress: <strong>{recordOfWork.completedWeeksCount} of {recordOfWork.totalPlannedWeeks} Weeks Delivered</strong>
              </span>
              <span className="font-bold text-primary">
                {recordOfWork.syllabusCompletionRate}% Delivered
              </span>
            </div>

            <table className="w-full border-collapse border border-text-primary text-left text-[11px]">
              <thead>
                <tr className="border-b border-text-primary bg-surface-subtle font-bold uppercase">
                  <th className="border-r border-text-primary p-2 w-14 text-center">Wk</th>
                  <th className="border-r border-text-primary p-2 w-24">Date</th>
                  <th className="border-r border-text-primary p-2">Work Covered / Activities</th>
                  <th className="border-r border-text-primary p-2">Specific Outcomes Achieved</th>
                  <th className="border-r border-text-primary p-2 w-28">Attendance</th>
                  <th className="border-r border-text-primary p-2 w-32">Remarks / Deviations</th>
                  <th className="p-2 w-24 text-center">Trainer Sign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recordOfWork.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-text-muted italic">
                      No progress entries logged yet. Log entries using the trainer Record of Work manager.
                    </td>
                  </tr>
                ) : (
                  recordOfWork.entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border">
                      <td className="border-r border-text-primary p-2 text-center font-bold">
                        W{entry.weekNumber}
                      </td>
                      <td className="border-r border-text-primary p-2 font-medium text-text-secondary whitespace-nowrap">
                        {entry.sessionDate}
                      </td>
                      <td className="border-r border-text-primary p-2 font-semibold text-text-primary">
                        {entry.workCovered}
                      </td>
                      <td className="border-r border-text-primary p-2 text-text-secondary">
                        {entry.outcomesAchieved}
                      </td>
                      <td className="border-r border-text-primary p-2 text-text-secondary">
                        {entry.attendanceSummary}
                      </td>
                      <td className="border-r border-text-primary p-2 text-text-muted text-[10px]">
                        {entry.remarks}
                      </td>
                      <td className="p-2 text-center font-bold text-[10px] text-text-primary">
                        {entry.trainerSignature.split(' ')[0] || 'Signed'}
                        <div className="text-[8px] text-text-muted">{new Date(entry.signedAt).toLocaleDateString('en-GB')}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Institutional Sign-off Block */}
        <div className="mt-8 border-t-2 border-text-primary pt-4 text-xs">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p className="font-bold text-text-primary uppercase text-[10px]">Trainer Sign-off:</p>
              <div className="mt-6 border-b border-text-primary" />
              <p className="mt-1 font-semibold text-text-secondary">{header.trainerName}</p>
              <p className="text-[10px] text-text-muted">Date: ________________________</p>
            </div>
            <div>
              <p className="font-bold text-text-primary uppercase text-[10px]">Head of Department (HOD):</p>
              <div className="mt-6 border-b border-text-primary" />
              <p className="mt-1 font-semibold text-text-secondary">Signature & Official Stamp</p>
              <p className="text-[10px] text-text-muted">Date: ________________________</p>
            </div>
            <div>
              <p className="font-bold text-text-primary uppercase text-[10px]">QA / Dean Verification:</p>
              <div className="mt-6 border-b border-text-primary" />
              <p className="mt-1 font-semibold text-text-secondary">Institutional Audit Stamp</p>
              <p className="text-[10px] text-text-muted">Date: ________________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
