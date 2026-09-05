import Image from 'next/image';

import type { StudentPortalRegistrationContext } from '@/features/student-portal/types';

/**
 * The preview mirrors the one-page Word form: calibrated to occupy 75% to 85%
 * of the page with comfortable writing heights and strict 1-page print fit.
 */
const MIN_SCALE_UNITS = 6;
const MAX_SCALE_UNITS = 12;

function lerp(spacious: number, compact: number, t: number): number {
  return spacious + (compact - spacious) * t;
}

interface PreviewMetrics {
  particularsPaddingMm: number;
  cellPaddingMm: number;
  cardGapMm: number;
  sectionGapMm: number;
}

function computePreviewMetrics(unitCount: number): PreviewMetrics {
  const t = Math.min(
    1,
    Math.max(0, (unitCount - MIN_SCALE_UNITS) / (MAX_SCALE_UNITS - MIN_SCALE_UNITS)),
  );

  return {
    particularsPaddingMm: lerp(1.7, 0.85, t),
    cellPaddingMm: lerp(1.7, 0.85, t),
    cardGapMm: lerp(4.5, 2.2, t),
    sectionGapMm: lerp(3.5, 1.8, t),
  };
}

function SectionHeading({ children, metrics }: { children: string; metrics: PreviewMetrics }) {
  return (
    <div
      className="border border-black text-center text-[9.5px] font-bold uppercase text-black"
      style={{
        padding: `${metrics.cellPaddingMm}mm 2mm`,
      }}
    >
      {children}
    </div>
  );
}

function ApprovalCard({
  title,
  approverLabel,
  metrics,
}: {
  title: string;
  approverLabel: string;
  metrics: PreviewMetrics;
}) {
  const cellStyle = { padding: `${metrics.cellPaddingMm}mm 2mm` };
  const cellClass = 'border border-black text-[9.5px] text-black';

  return (
    <div style={{ marginTop: `${metrics.cardGapMm}mm` }}>
      <div
        className="border border-black text-[9.5px] font-bold text-black"
        style={{ padding: `${metrics.cellPaddingMm}mm 2mm` }}
      >
        {title}
      </div>
      <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
        <div className={`${cellClass} font-semibold`} style={cellStyle}>
          {approverLabel}
        </div>
        <div className={cellClass} style={cellStyle}>&nbsp;</div>
        <div className={`${cellClass} font-semibold`} style={cellStyle}>
          Date
        </div>
        <div className={cellClass} style={cellStyle}>&nbsp;</div>
      </div>
      <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
        <div className={`${cellClass} font-semibold`} style={cellStyle}>
          Comment
        </div>
        <div className={cellClass} style={cellStyle}>&nbsp;</div>
        <div className={`${cellClass} font-semibold`} style={cellStyle}>
          Signature
        </div>
        <div className={cellClass} style={cellStyle}>&nbsp;</div>
      </div>
    </div>
  );
}

export function UnitRegistrationFormPreview({
  context,
}: {
  context: StudentPortalRegistrationContext;
}) {
  const units = context.units
    .filter((unit) => unit.registrationStatus === 'registered')
    .sort((first, second) => first.unitCode.localeCompare(second.unitCode, 'en', { numeric: true }));

  if (!context.period) return null;

  const metrics = computePreviewMetrics(units.length);
  const cellClass = 'border border-black text-[9.5px] text-black';
  const cellStyle = { padding: `${metrics.cellPaddingMm}mm 2mm` };
  const particularsCellStyle = { padding: `${metrics.particularsPaddingMm}mm 2mm` };
  const tableCellStyle = { padding: `${metrics.cellPaddingMm}mm 1.5mm` };

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white p-[8mm] font-sans text-[9.5px] leading-[1.2] text-black shadow-sm print:w-[210mm] print:max-w-none print:p-[8mm] print:shadow-none print:break-inside-avoid">
      <header className="flex items-center justify-center gap-3 text-center">
        <Image src="/branding/icmhs-logo.png" alt="Imperial College of Medical and Health Sciences" width={58} height={44} className="shrink-0" />
        <div>
          <h2 className="text-[12px] font-bold text-black">IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES</h2>
          <p className="mt-0.5 text-[10px] font-bold text-black">CONTINUING STUDENT UNIT REGISTRATION FORM</p>
        </div>
      </header>

      <section className="border border-black" style={{ marginTop: `${metrics.sectionGapMm}mm` }}>
        <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
          <p style={particularsCellStyle}><strong>Name:</strong> {context.student.fullName}</p>
          <p style={particularsCellStyle}><strong>Admission No:</strong> {context.student.admissionNumber}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
          <p style={particularsCellStyle}><strong>Course:</strong> {context.student.programmeName}</p>
          <p style={particularsCellStyle}><strong>Stage:</strong> {context.student.stageCode ?? context.student.stageName ?? ''}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
          <p style={particularsCellStyle}><strong>Department:</strong> {context.student.departmentName}</p>
          <p style={particularsCellStyle}><strong>Intake:</strong> {context.student.cohortName ?? ''}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black">
          <p style={particularsCellStyle}><strong>Academic Period:</strong> {context.period.name}</p>
          <p style={particularsCellStyle}><strong>Resident:</strong></p>
        </div>
      </section>

      <div style={{ marginTop: `${metrics.sectionGapMm}mm` }}>
        <SectionHeading metrics={metrics}>Registered Units</SectionHeading>
      </div>
      <table className="w-full border-collapse border border-black text-[9.5px] text-black">
        <thead>
          <tr>
            <th className="w-10 border border-black text-center font-bold" style={tableCellStyle}>S/No.</th>
            <th className="w-24 border border-black text-left font-bold" style={tableCellStyle}>Unit Code</th>
            <th className="border border-black text-left font-bold" style={tableCellStyle}>Unit Name</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit, index) => (
            <tr key={unit.registrationId}>
              <td className="border border-black text-center" style={tableCellStyle}>{index + 1}</td>
              <td className="border border-black font-bold" style={tableCellStyle}>{unit.unitCode}</td>
              <td className="border border-black" style={tableCellStyle}>{unit.unitName}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: `${metrics.cardGapMm}mm` }}>
        <div
          className="border border-black text-[9.5px] font-bold text-black"
          style={{ padding: `${metrics.cellPaddingMm}mm 2mm` }}
        >
          ACCOUNTS.
        </div>
        <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
          <div className={`${cellClass} font-semibold`} style={cellStyle}>Previous balance: KShs</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
          <div className={`${cellClass} font-semibold`} style={cellStyle}>Amount paid</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
        </div>
        <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
          <div className={`${cellClass} font-semibold`} style={cellStyle}>Balance: KShs</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
          <div className={`${cellClass} font-semibold`} style={cellStyle}>Hostel fees</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
        </div>
        <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
          <div className={`${cellClass} font-semibold`} style={cellStyle}>Date</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
          <div className={`${cellClass} font-semibold`} style={cellStyle}>Signature</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
        </div>
      </div>

      <ApprovalCard title="HOD APPROVAL" approverLabel="Approved/not approved by: HOD:" metrics={metrics} />
      <ApprovalCard title="HOSTEL ALLOCATION." approverLabel="Administrator:" metrics={metrics} />
      <ApprovalCard title="REGISTRAR APPROVAL" approverLabel="REGISTRAR:" metrics={metrics} />
      <ApprovalCard title="PRINCIPAL APPROVAL" approverLabel="PRINCIPAL:" metrics={metrics} />
      <ApprovalCard title="MANAGING DIRECTOR APPROVAL" approverLabel="MANAGING DIRECTOR:" metrics={metrics} />

      <footer className="mt-2 text-center text-[9px] text-black italic">
        This form should be filled in one copy and filed at the Registrar of Students.
      </footer>
    </article>
  );
}
