import Image from 'next/image';

import type { KnecBookingFormContext } from './types';

function OfficialApprovalCard({
  num,
  title,
  approverLabel,
  paddingClass,
  linePbClass,
}: {
  num: number;
  title: string;
  approverLabel: string;
  paddingClass: string;
  linePbClass: string;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-slate-600 bg-white">
      <div className="bg-slate-200 px-2.5 py-0.5 text-[9.5px] font-bold text-slate-900 border-b border-slate-500">
        {num}. {title}
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-[1.6fr_1fr] gap-3 ${paddingClass} text-[9px] text-slate-900`}>
        <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
          {approverLabel}
        </div>
        <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
          Date:
        </div>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-[1.6fr_1fr] gap-3 ${paddingClass} pt-0 text-[9px] text-slate-900`}>
        <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
          Comment:
        </div>
        <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
          Signature:
        </div>
      </div>
    </div>
  );
}

export function KnecBookingFormPreview({ context }: { context: KnecBookingFormContext }) {
  const allPapers = context.modulesSummary.flatMap((mod) =>
    mod.papers.map((paper) => ({
      moduleCode: mod.moduleCode,
      ...paper,
    })),
  );

  const rowCount = allPapers.length;
  const cardPaddingClass = rowCount <= 7 ? 'p-2 sm:p-2.5' : 'p-1.5 sm:p-2';
  const linePbClass = rowCount <= 7 ? 'pb-2 sm:pb-2.5' : 'pb-1 sm:pb-1.5';
  const sectionMarginClass = rowCount <= 7 ? 'mt-2.5 sm:mt-3' : 'mt-1.5 sm:mt-2';

  return (
    <article className="mx-auto w-full max-w-[210mm] min-h-[290mm] bg-white p-4 sm:p-[7mm] font-sans text-[10px] leading-tight text-slate-900 shadow-sm print:w-[210mm] print:max-w-none print:min-h-[282mm] print:p-[7mm] print:shadow-none flex flex-col justify-between">
      <div className="flex-1 flex flex-col">
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-900 pb-2 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/branding/icmhs-logo.png"
              alt="ICMHS Logo"
              width={46}
              height={34}
              className="shrink-0 object-contain"
            />
            <div className="min-w-0">
              <h1 className="text-[11.5px] sm:text-[12.5px] font-extrabold uppercase tracking-wide text-slate-900 truncate">
                Imperial College of Medical and Health Sciences
              </h1>
              <p className="text-[8px] italic text-slate-600">Committed to Professional Excellence</p>
              <p className="text-[8px] font-bold text-slate-800 mt-0.5">
                OFFICE OF THE REGISTRAR (KNEC EXAMINATION BOOKING)
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right text-[8.5px] sm:text-[9px] text-slate-600 shrink-0">
            <span className="text-[7.5px] text-slate-500 uppercase tracking-wider block">KNEC Exam Series</span>
            <span className="font-bold text-slate-900">{context.booking.seriesName}</span>
          </div>
        </header>

        {/* DOCUMENT TITLE */}
        <div className="mt-2 text-center">
          <h2 className="text-[10.5px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-900">
            KNEC EXAMINATION BOOKING &amp; CLEARANCE FORM
          </h2>
        </div>

        {/* STUDENT PARTICULARS */}
        <section className={`${sectionMarginClass} rounded-sm border border-slate-600 bg-slate-50/40`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-400 border-b border-slate-400 text-[9px] text-slate-900">
            <div className="p-1.5">
              <strong>Student Name:</strong> {context.student.fullName}
            </div>
            <div className="p-1.5">
              <strong>Admission No:</strong> {context.student.admissionNumber}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-400 border-b border-slate-400 text-[9px] text-slate-900">
            <div className="p-1.5">
              <strong>KNEC Index No:</strong> {context.student.knecIndexNumber ?? 'To be assigned'}
            </div>
            <div className="p-1.5">
              <strong>Exam Series:</strong> {context.booking.seriesName} ({context.booking.bookingType.toUpperCase()})
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-400 text-[9px] text-slate-900">
            <div className="p-1.5">
              <strong>Course Track:</strong> {context.student.programmeName}
            </div>
            <div className="p-1.5">
              <strong>Department / Intake:</strong> {context.student.departmentName}
              {context.student.cohortName ? ` · ${context.student.cohortName}` : ''}
            </div>
          </div>
        </section>

        {/* BOOKED PAPERS TABLE */}
        <section className={sectionMarginClass}>
          <div className="bg-slate-200 px-2.5 py-1 text-center text-[9.5px] font-bold uppercase tracking-wider text-slate-900 border border-slate-600 border-b-0">
            Registered KNEC Modules &amp; Examination Papers ({allPapers.length} Papers ·{' '}
            {context.modulesSummary.map((m) => m.moduleCode).join(', ')})
          </div>
          <table className="w-full border-collapse border border-slate-600 text-[8.5px]">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-900 border-b border-slate-600">
                <th className="w-8 border-r border-slate-400 p-1 text-center">S/N</th>
                <th className="w-20 border-r border-slate-400 p-1 text-left">Module</th>
                <th className="w-24 border-r border-slate-400 p-1 text-left">Paper Code</th>
                <th className="border-r border-slate-400 p-1 text-left">Paper Title</th>
                <th className="w-20 p-1 text-center">Type</th>
              </tr>
            </thead>
            <tbody>
              {allPapers.map((paper, idx) => (
                <tr key={paper.paperCode} className="border-b border-slate-400 odd:bg-white even:bg-slate-50/30">
                  <td className="border-r border-slate-400 p-1 text-center font-medium">{idx + 1}</td>
                  <td className="border-r border-slate-400 p-1 font-semibold">{paper.moduleCode}</td>
                  <td className="border-r border-slate-400 p-1 font-bold">{paper.paperCode}</td>
                  <td className="border-r border-slate-400 p-1">{paper.paperName}</td>
                  <td className="p-1 text-center font-semibold uppercase">
                    {paper.isResit ? 'Resit' : 'Normal'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 5 OFFICIAL APPROVAL & CLEARANCE CARDS */}
        <div className="flex-1 flex flex-col justify-between mt-2.5 sm:mt-3 gap-1.5">
          <OfficialApprovalCard
            num={1}
            title="HOD APPROVAL"
            approverLabel="Approved/not approved by: HOD:"
            paddingClass={cardPaddingClass}
            linePbClass={linePbClass}
          />

          <div className="overflow-hidden rounded-sm border border-slate-600 bg-white">
            <div className="bg-slate-200 px-2.5 py-0.5 text-[9.5px] font-bold text-slate-900 border-b border-slate-500">
              2. ACCOUNTS CLEARANCE (KNEC EXAM &amp; TUITION FEES)
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${cardPaddingClass} text-[9px] text-slate-900`}>
              <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold`}>
                KNEC Exam Fee Paid: KShs
              </div>
              <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold`}>
                Fee Balance: KShs
              </div>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-3 ${cardPaddingClass} pt-0 text-[9px] text-slate-900`}>
              <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold`}>
                Accounts Officer:
              </div>
              <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold`}>
                Signature:
              </div>
              <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold`}>
                Date:
              </div>
            </div>
          </div>

          <OfficialApprovalCard
            num={3}
            title="REGISTRAR APPROVAL"
            approverLabel="REGISTRAR:"
            paddingClass={cardPaddingClass}
            linePbClass={linePbClass}
          />
          <OfficialApprovalCard
            num={4}
            title="PRINCIPAL APPROVAL"
            approverLabel="PRINCIPAL:"
            paddingClass={cardPaddingClass}
            linePbClass={linePbClass}
          />
          <OfficialApprovalCard
            num={5}
            title="MANAGING DIRECTOR APPROVAL"
            approverLabel="MANAGING DIRECTOR:"
            paddingClass={cardPaddingClass}
            linePbClass={linePbClass}
          />
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-2 text-center border-t border-slate-300 pt-1 text-[8.5px] text-slate-500 italic">
        Ref: {context.booking.clearanceRef ?? 'ICMHS/KNEC'} &nbsp;|&nbsp; Present this form sequentially for HOD, Accounts, Registrar, Principal, and Managing Director signoff.
      </footer>
    </article>
  );
}
