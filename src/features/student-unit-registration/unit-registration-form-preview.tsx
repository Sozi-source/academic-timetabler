import Image from 'next/image';

import type { StudentPortalRegistrationContext } from '@/features/student-portal/types';

function OfficialApprovalCard({
  num,
  title,
  approverLabel,
  marginClass,
  paddingClass,
  linePbClass,
}: {
  num: number;
  title: string;
  approverLabel: string;
  marginClass: string;
  paddingClass: string;
  linePbClass: string;
}) {
  return (
    <div className={`${marginClass} overflow-hidden rounded-sm border border-slate-600 bg-white`}>
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

export function UnitRegistrationFormPreview({
  context,
}: {
  context: StudentPortalRegistrationContext;
}) {
  if (!context.period) return null;

  const registeredUnits = context.units
    .filter((unit) => unit.registrationStatus === 'registered')
    .sort((a, b) => a.unitCode.localeCompare(b.unitCode, 'en', { numeric: true }));

  const halfCount = Math.ceil(registeredUnits.length / 2);
  const leftUnits = registeredUnits.slice(0, halfCount);
  const rightUnits = registeredUnits.slice(halfCount);
  const rowCount = Math.max(1, halfCount);

  // Stable 1-page A4 print budget:
  // Ensures strict 1-page fit across 1 to 12 registered units with +1mm expanded writing cards.
  const cardMarginClass = rowCount <= 3 ? 'mt-3' : rowCount === 4 ? 'mt-2' : 'mt-1.5';
  const cardPaddingClass = rowCount <= 3 ? 'p-2.5' : rowCount === 4 ? 'p-2' : 'p-1.5';
  const linePbClass = rowCount <= 3 ? 'pb-2' : rowCount === 4 ? 'pb-1.5' : 'pb-1';
  const sectionMarginClass = rowCount <= 3 ? 'mt-3' : rowCount === 4 ? 'mt-2' : 'mt-1.5';

  return (
    <article className="mx-auto w-full max-w-[210mm] min-h-[285mm] bg-white p-4 sm:p-[8mm] font-sans text-[10px] leading-tight text-slate-900 shadow-sm print:w-[210mm] print:max-w-none print:min-h-0 print:p-[8mm] print:shadow-none print:break-inside-avoid flex flex-col justify-between">
      <div>
        {/* HEADER SECTION (OFFICIAL LETTERHEAD STYLE) */}
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
              <p className="text-[8px] italic text-slate-600">
                Committed to Professional Excellence
              </p>
              <p className="text-[8px] font-bold text-slate-800 mt-0.5">
                OFFICE OF THE REGISTRAR (ACADEMIC AFFAIRS)
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right text-[8.5px] sm:text-[9px] text-slate-600 shrink-0">
            <span className="text-[7.5px] text-slate-500 uppercase tracking-wider block">Semester / Period</span>
            <span className="font-bold text-slate-900">{context.period.name}</span>
          </div>
        </header>

        {/* CENTERED DOCUMENT FORM TITLE */}
        <div className="mt-2 text-center">
          <h2 className="text-[10.5px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-900">
            CONTINUING STUDENT UNIT REGISTRATION FORM
          </h2>
        </div>

        {/* STUDENT PARTICULARS (3 ROWS) */}
        <section className={`${sectionMarginClass} rounded-sm border border-slate-600 bg-slate-50/40`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-400 border-b border-slate-400 text-[9px] text-slate-900">
            <div className="p-1.5"><strong className="text-slate-900">Student Name:</strong> {context.student.fullName}</div>
            <div className="p-1.5"><strong className="text-slate-900">Admission No:</strong> {context.student.admissionNumber}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-400 border-b border-slate-400 text-[9px] text-slate-900">
            <div className="p-1.5"><strong className="text-slate-900">Course:</strong> {context.student.programmeName}</div>
            <div className="p-1.5"><strong className="text-slate-900">Stage:</strong> {context.student.stageCode ?? context.student.stageName ?? 'N/A'}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-400 text-[9px] text-slate-900">
            <div className="p-1.5"><strong className="text-slate-900">Department:</strong> {context.student.departmentName}</div>
            <div className="p-1.5"><strong className="text-slate-900">Intake:</strong> {context.student.cohortName ?? 'N/A'}</div>
          </div>
        </section>

        {/* REGISTERED UNITS SECTION */}
        <section className={sectionMarginClass}>
          <div className="bg-slate-200 px-2.5 py-1 text-center text-[9.5px] font-bold uppercase tracking-wider text-slate-900 border border-slate-600 border-b-0">
            Registered Units Overview ({registeredUnits.length} Units)
          </div>

          {/* 1. Mobile Layout: Single 1-Column Table (< sm) */}
          <table className="w-full border-collapse border border-slate-600 text-[9px] table sm:hidden print:hidden">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-900 border-b border-slate-600">
                <th className="w-8 border-r border-slate-400 p-1 text-center">S/N</th>
                <th className="w-20 border-r border-slate-400 p-1 text-left">Code</th>
                <th className="p-1 text-left">Unit Name</th>
              </tr>
            </thead>
            <tbody>
              {registeredUnits.map((unit, idx) => (
                <tr key={unit.registrationId} className="border-b border-slate-400 odd:bg-white even:bg-slate-50/30 text-slate-900">
                  <td className="border-r border-slate-400 p-1 text-center font-medium text-slate-900">{idx + 1}</td>
                  <td className="border-r border-slate-400 p-1 font-bold text-slate-900">{unit.unitCode}</td>
                  <td className="p-1 text-slate-900">{unit.unitName}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 2. Desktop & Print Layout: Official 2-Column Table Grid (>= sm & print) */}
          <table className="w-full border-collapse border border-slate-600 text-[8.5px] hidden sm:table print:table">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-900 border-b border-slate-600">
                <th className="w-7 border-r border-slate-400 p-1 text-center">S/N</th>
                <th className="w-18 border-r border-slate-400 p-1 text-left">Code</th>
                <th className="border-r border-slate-400 p-1 text-left">Unit Name</th>
                <th className="w-7 border-r border-slate-400 p-1 text-center">S/N</th>
                <th className="w-18 border-r border-slate-400 p-1 text-left">Code</th>
                <th className="p-1 text-left">Unit Name</th>
              </tr>
            </thead>
            <tbody>
              {leftUnits.map((leftUnit, idx) => {
                const rightUnit = rightUnits[idx];
                return (
                  <tr key={leftUnit.registrationId} className="border-b border-slate-400 odd:bg-white even:bg-slate-50/30 text-slate-900">
                    <td className="border-r border-slate-400 p-1 text-center font-medium text-slate-900">{idx + 1}</td>
                    <td className="border-r border-slate-400 p-1 font-bold text-slate-900">{leftUnit.unitCode}</td>
                    <td className="border-r border-slate-400 p-1 text-slate-900">{leftUnit.unitName}</td>
                    <td className="border-r border-slate-400 p-1 text-center font-medium text-slate-900">
                      {rightUnit ? idx + halfCount + 1 : ''}
                    </td>
                    <td className="border-r border-slate-400 p-1 font-bold text-slate-900">
                      {rightUnit ? rightUnit.unitCode : ''}
                    </td>
                    <td className="p-1 text-slate-900">
                      {rightUnit ? rightUnit.unitName : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* 1. ACCOUNTS CLEARANCE CARD */}
        <div className="mt-[8mm] overflow-hidden rounded-sm border border-slate-600 bg-white">
          <div className="bg-slate-200 px-2.5 py-0.5 text-[9.5px] font-bold text-slate-900 border-b border-slate-500">
            1. ACCOUNTS CLEARANCE
          </div>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${cardPaddingClass} text-[9px] text-slate-900`}>
            <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
              Previous balance: KShs
            </div>
            <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
              Amount paid: KShs
            </div>
          </div>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${cardPaddingClass} pt-0 text-[9px] text-slate-900`}>
            <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
              Balance: KShs
            </div>
            <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
              Hostel fees: KShs
            </div>
          </div>
          <div className={`grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-3 ${cardPaddingClass} pt-0 text-[9px] text-slate-900`}>
            <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
              Accounts Officer:
            </div>
            <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
              Signature:
            </div>
            <div className={`border-b border-dotted border-slate-700 ${linePbClass} font-semibold text-slate-900`}>
              Date:
            </div>
          </div>
        </div>

        {/* 2-6. OFFICIAL APPROVAL CARDS */}
        <OfficialApprovalCard
          num={2}
          title="HOD APPROVAL"
          approverLabel="Approved/not approved by: HOD:"
          marginClass={cardMarginClass}
          paddingClass={cardPaddingClass}
          linePbClass={linePbClass}
        />
        <OfficialApprovalCard
          num={3}
          title="HOSTEL ALLOCATION"
          approverLabel="Administrator:"
          marginClass={cardMarginClass}
          paddingClass={cardPaddingClass}
          linePbClass={linePbClass}
        />
        <OfficialApprovalCard
          num={4}
          title="REGISTRAR APPROVAL"
          approverLabel="REGISTRAR:"
          marginClass={cardMarginClass}
          paddingClass={cardPaddingClass}
          linePbClass={linePbClass}
        />
        <OfficialApprovalCard
          num={5}
          title="PRINCIPAL APPROVAL"
          approverLabel="PRINCIPAL:"
          marginClass={cardMarginClass}
          paddingClass={cardPaddingClass}
          linePbClass={linePbClass}
        />
        <OfficialApprovalCard
          num={6}
          title="MANAGING DIRECTOR APPROVAL"
          approverLabel="MANAGING DIRECTOR:"
          marginClass={cardMarginClass}
          paddingClass={cardPaddingClass}
          linePbClass={linePbClass}
        />
      </div>

      {/* FOOTER */}
      <footer className="mt-3 text-center border-t border-slate-300 pt-1.5 text-[8.5px] text-slate-500 italic">
        Form Ref: ICMHS/REG/2026/0482 &nbsp;|&nbsp; This form should be filled in one copy and filed at the Registrar of Students.
      </footer>
    </article>
  );
}
