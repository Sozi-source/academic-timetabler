import Image from 'next/image';

import type { StudentPortalRegistrationContext } from '@/features/student-portal/types';

const HEADER_FILL = '#DCE9ED';
const CARD_BORDER = '#7DA6B3';
const PARTICULARS_BORDER = '#334155';

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
      className="border text-[9.5px] font-bold uppercase text-[#0F4C5C]"
      style={{
        backgroundColor: HEADER_FILL,
        borderColor: PARTICULARS_BORDER,
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
  const cellStyle = { borderColor: CARD_BORDER, padding: `${metrics.cellPaddingMm}mm 2mm` };
  const labelCellStyle = { ...cellStyle, backgroundColor: '#F7FAFC' };
  const cellClass = 'border text-[9.5px]';

  return (
    <div style={{ marginTop: `${metrics.cardGapMm}mm` }}>
      <div
        className="border text-[9.5px] font-bold text-[#0F4C5C]"
        style={{ backgroundColor: HEADER_FILL, borderColor: CARD_BORDER, padding: `${metrics.cellPaddingMm}mm 2mm` }}
      >
        {title}
      </div>
      <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
        <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>
          {approverLabel}
        </div>
        <div className={cellClass} style={cellStyle}>&nbsp;</div>
        <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>
          Date
        </div>
        <div className={cellClass} style={cellStyle}>&nbsp;</div>
      </div>
      <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
        <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>
          Comment
        </div>
        <div className={cellClass} style={cellStyle}>&nbsp;</div>
        <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>
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
  const cellClass = 'border text-[9.5px]';
  const cellStyle = { borderColor: CARD_BORDER, padding: `${metrics.cellPaddingMm}mm 2mm` };
  const labelCellStyle = { ...cellStyle, backgroundColor: '#F7FAFC' };
  const particularsCellStyle = { padding: `${metrics.particularsPaddingMm}mm 2mm` };
  const tableCellStyle = { borderColor: PARTICULARS_BORDER, padding: `${metrics.cellPaddingMm}mm 1.5mm` };

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white p-[8mm] font-sans text-[9.5px] leading-[1.2] text-black shadow-sm print:w-[210mm] print:max-w-none print:p-[8mm] print:shadow-none print:break-inside-avoid">
      <header className="flex items-center justify-center gap-3 text-center">
        <Image src="/branding/icmhs-logo.png" alt="Imperial College of Medical and Health Sciences" width={58} height={44} className="shrink-0" />
        <div>
          <h2 className="text-[12px] font-bold text-[#0F172A]">IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES</h2>
          <p className="mt-0.5 text-[10px] font-bold text-[#0F4C5C]">CONTINUING STUDENT UNIT REGISTRATION FORM</p>
        </div>
      </header>

      <section className="border" style={{ borderColor: PARTICULARS_BORDER, marginTop: `${metrics.sectionGapMm}mm` }}>
        <div className="grid grid-cols-2 divide-x border-b" style={{ borderColor: PARTICULARS_BORDER }}>
          <p style={particularsCellStyle}><strong>Name:</strong> {context.student.fullName}</p>
          <p style={particularsCellStyle}><strong>Admission No:</strong> {context.student.admissionNumber}</p>
        </div>
        <div className="grid grid-cols-2 divide-x border-b" style={{ borderColor: PARTICULARS_BORDER }}>
          <p style={particularsCellStyle}><strong>Course:</strong> {context.student.programmeName}</p>
          <p style={particularsCellStyle}><strong>Stage:</strong> {context.student.stageCode ?? context.student.stageName ?? ''}</p>
        </div>
        <div className="grid grid-cols-2 divide-x border-b" style={{ borderColor: PARTICULARS_BORDER }}>
          <p style={particularsCellStyle}><strong>Department:</strong> {context.student.departmentName}</p>
          <p style={particularsCellStyle}><strong>Intake:</strong> {context.student.cohortName ?? ''}</p>
        </div>
        <div className="grid grid-cols-2 divide-x" style={{ borderColor: PARTICULARS_BORDER }}>
          <p style={particularsCellStyle}><strong>Academic Period:</strong> {context.period.name}</p>
          <p style={particularsCellStyle}><strong>Resident:</strong></p>
        </div>
      </section>

      <div style={{ marginTop: `${metrics.sectionGapMm}mm` }}>
        <SectionHeading metrics={metrics}>Registered Units</SectionHeading>
      </div>
      <table className="w-full border-collapse border text-[9.5px]" style={{ borderColor: PARTICULARS_BORDER }}>
        <thead>
          <tr style={{ backgroundColor: HEADER_FILL }}>
            <th className="w-10 border text-center" style={tableCellStyle}>S/No.</th>
            <th className="w-24 border text-left" style={tableCellStyle}>Unit Code</th>
            <th className="border text-left" style={tableCellStyle}>Unit Name</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit, index) => (
            <tr key={unit.registrationId}>
              <td className="border text-center" style={tableCellStyle}>{index + 1}</td>
              <td className="border font-bold" style={tableCellStyle}>{unit.unitCode}</td>
              <td className="border" style={tableCellStyle}>{unit.unitName}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: `${metrics.cardGapMm}mm` }}>
        <div
          className="border text-[9.5px] font-bold text-[#0F4C5C]"
          style={{ backgroundColor: HEADER_FILL, borderColor: CARD_BORDER, padding: `${metrics.cellPaddingMm}mm 2mm` }}
        >
          ACCOUNTS.
        </div>
        <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
          <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>Previous balance: KShs</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
          <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>Amount paid</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
        </div>
        <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
          <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>Balance: KShs</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
          <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>Hostel fees</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
        </div>
        <div className="grid grid-cols-[1.1fr_1.6fr_0.55fr_1.3fr]">
          <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>Date</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
          <div className={`${cellClass} font-semibold text-[#334155]`} style={labelCellStyle}>Signature</div>
          <div className={cellClass} style={cellStyle}>&nbsp;</div>
        </div>
      </div>

      <ApprovalCard title="HOD APPROVAL" approverLabel="Approved/not approved by: HOD:" metrics={metrics} />
      <ApprovalCard title="HOSTEL ALLOCATION." approverLabel="Administrator:" metrics={metrics} />
      <ApprovalCard title="REGISTRAR APPROVAL" approverLabel="REGISTRAR:" metrics={metrics} />
      <ApprovalCard title="PRINCIPAL APPROVAL" approverLabel="PRINCIPAL:" metrics={metrics} />
      <ApprovalCard title="MANAGING DIRECTOR APPROVAL" approverLabel="MANAGING DIRECTOR:" metrics={metrics} />

      <footer className="mt-2 text-center text-[9px] text-[#475569] italic">
        This form should be filled in one copy and filed at the Registrar of Students.
      </footer>
    </article>
  );
}
