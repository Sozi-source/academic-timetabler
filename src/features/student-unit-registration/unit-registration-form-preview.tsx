import Image from 'next/image';

import type { StudentPortalRegistrationContext } from '@/features/student-portal/types';

const signOffLines = [
  'ACCOUNTS.',
  'Previous balance: KShs………………………………………………….………Amount Paid………….………………………………….',
  'Balance: KShs……………………………………………………………………Hostel Fees…………………………………………….',
  'Date: ……………………………………………………………………………Signature: ………………………………………',
  'Approved/not approved by: HOD: ……………………………………………Date: ………………………………………….',
  'Comment: ………………………………………………………………………Signature: ……………………………………',
  'HOSTEL ALLOCATION.',
  'Administrator: …………………………………………………………………Date: ………………………………………….',
  'Comment: …………………………………………………………………………………Signature………………………………………',
  'REGISTRAR: …………………………………………………………….Date: ………………………………………….',
  'Comment: ……………………………………………………………….Signature: ………………………………………',
  'PRINCIPAL: ………………………………………………… ……….Date: ………………………………………',
  'Comment: ………………………………………………………………….Signature: ……………………………………',
  'MANAGING DIRECTOR: ………………………………………………Date: ……………………………….',
  'Comment: ………………………………………………………………….Signature: …………………………………….',
];

export function UnitRegistrationFormPreview({
  context,
}: {
  context: StudentPortalRegistrationContext;
}) {
  const units = context.units
    .filter((unit) => unit.registrationStatus === 'registered')
    .sort((first, second) => first.unitCode.localeCompare(second.unitCode, 'en', { numeric: true }));

  if (!context.period) return null;

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white p-[9mm] font-serif text-[9px] leading-[1.15] text-black shadow-sm print:w-[210mm] print:max-w-none print:p-[9mm] print:shadow-none">
      <header className="flex items-center justify-center gap-3 text-center">
        <Image src="/branding/icmhs-logo.png" alt="Imperial College of Medical and Health Sciences" width={58} height={44} className="shrink-0" />
        <div>
          <h2 className="text-[12px] font-bold">IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES</h2>
          <p className="mt-0.5 text-[10px] font-bold">CONTINUING STUDENT&apos;S UNIT REGISTRATION FORM</p>
          <p className="mt-0.5 text-[9px] font-bold uppercase">{context.student.programmeName}</p>
        </div>
      </header>

      <section className="mt-2 border border-black">
        <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
          <p className="p-1"><strong>Name:</strong> {context.student.fullName}</p>
          <p className="p-1"><strong>Admission No:</strong> {context.student.admissionNumber}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
          <p className="p-1"><strong>Course:</strong> {context.student.programmeName}</p>
          <p className="p-1"><strong>Stage:</strong> {context.student.stageCode ?? context.student.stageName ?? ''}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
          <p className="p-1"><strong>Department:</strong> {context.student.departmentName}</p>
          <p className="p-1"><strong>Intake:</strong> {context.student.cohortName ?? ''}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black">
          <p className="p-1"><strong>Academic Period:</strong> {context.period.name}</p>
          <p className="p-1"><strong>Resident:</strong> _____________________</p>
        </div>
      </section>

      <h3 className="my-1.5 text-center text-[10px] font-bold">UNIT REGISTRATION</h3>
      <table className="w-full border-collapse border border-black text-[9px]">
        <thead>
          <tr className="bg-slate-100 text-left">
            <th className="w-10 border border-black px-1 py-0.5 text-center">S/NO.</th>
            <th className="w-24 border border-black px-1 py-0.5">Unit codes</th>
            <th className="border border-black px-1 py-0.5">Unit name</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit, index) => (
            <tr key={unit.registrationId}>
              <td className="border border-black px-1 py-0.5 text-center">{index + 1}</td>
              <td className="border border-black px-1 py-0.5 font-bold">{unit.unitCode}</td>
              <td className="border border-black px-1 py-0.5">{unit.unitName}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-2 space-y-0 font-serif text-[9px] leading-[1.25]">
        {signOffLines.map((line, index) => (
          <p
            key={`${line}-${index}`}
            className={`whitespace-pre ${[0, 6].includes(index) ? 'font-bold' : ''} ${[3, 5, 8, 10, 12].includes(index) ? 'mb-1' : ''}`}
          >
            {line}
          </p>
        ))}
      </section>

      <footer className="mt-2 text-center text-[9px]">
        This form should be filled in one copy and filed in HODs and Registrar&apos;s Office.
      </footer>
    </article>
  );
}
