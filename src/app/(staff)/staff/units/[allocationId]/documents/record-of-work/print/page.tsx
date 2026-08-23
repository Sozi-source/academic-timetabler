import {
  notFound,
} from 'next/navigation';

import {
  getOnlineRecordOfWorkContext,
} from '@/features/teaching-documents/record-of-work-online/queries';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

function dateLabel(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day:
        '2-digit',
      month:
        '2-digit',
      year:
        'numeric',
      timeZone:
        'UTC',
    },
  ).format(
    new Date(
      `${value}T00:00:00Z`,
    ),
  );
}

export default async function PrintRecordOfWorkPage({
  params,
}: PageProps) {
  const {
    allocationId,
  } =
    await params;

  const context =
    await getOnlineRecordOfWorkContext(
      allocationId,
    );

  if (
    !context
  ) {
    notFound();
  }

  const {
    header,
    entries,
  } =
    context;

  const meta = [
    [
      'Department',
      header.departmentName,
      'Course',
      header.programmeName,
    ],
    [
      'Semester',
      header.academicPeriodName,
      'Unit of Competence',
      header.unitName,
    ],
    [
      'Unit Code',
      header.unitCode,
      'Trainer',
      header.trainerName,
    ],
    [
      'Trainer Number',
      header.trainerNumber ||
        '—',
      'Class',
      header.cohortName,
    ],
    [
      'Category / Level',
      header.categoryLevel ||
        '—',
      'Review Period',
      header.reviewPeriod,
    ],
  ];

  return (
    <main className="mx-auto max-w-[1500px] bg-white p-6 text-black print:max-w-none print:p-0">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 12mm;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mb-4 text-right text-xs text-gray-600">
        Use your browser print command to print or save as PDF.
      </div>

      <header className="border-b-2 border-black pb-3 text-center">
        <img
          src="/branding/icmhs-logo.png"
          alt="ICMHS logo"
          className="mx-auto mb-2 h-16 w-16 object-contain"
        />
        <h1 className="text-lg font-bold uppercase">
          {
            header.institutionName
          }
        </h1>
        <p className="mt-1 text-sm font-bold uppercase">
          Record of Work
        </p>
      </header>

      <table className="mt-4 w-full border-collapse text-[11px]">
        <tbody>
          {meta.map(
            (
              row,
            ) => (
              <tr
                key={
                  row[0]
                }
              >
                <th className="w-[12%] border border-black bg-gray-100 px-2 py-1.5 text-left">
                  {
                    row[0]
                  }
                </th>
                <td className="w-[38%] border border-black px-2 py-1.5">
                  {
                    row[1]
                  }
                </td>
                <th className="w-[12%] border border-black bg-gray-100 px-2 py-1.5 text-left">
                  {
                    row[2]
                  }
                </th>
                <td className="w-[38%] border border-black px-2 py-1.5">
                  {
                    row[3]
                  }
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <table className="mt-5 w-full border-collapse text-[9px]">
        <thead>
          <tr>
            {[
              'Date',
              'Time',
              'Topic Covered',
              'Objectives of the Lesson',
              'Mode of Delivery',
              'Remarks / Comments',
              'Trainer Signature',
              'Class Representative',
            ].map(
              (
                heading,
              ) => (
                <th
                  key={
                    heading
                  }
                  className="border border-black bg-gray-100 px-2 py-2 text-left align-bottom font-bold"
                >
                  {
                    heading
                  }
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {entries.length ===
          0 ? (
            <tr>
              <td
                colSpan={8}
                className="border border-black px-3 py-8 text-center"
              >
                No lessons recorded.
              </td>
            </tr>
          ) : (
            entries.map(
              (
                entry,
              ) => (
                <tr
                  key={
                    entry.id
                  }
                >
                  <td className="whitespace-nowrap border border-black px-2 py-2 align-top">
                    {
                      dateLabel(
                        entry.sessionDate,
                      )
                    }
                  </td>
                  <td className="whitespace-nowrap border border-black px-2 py-2 align-top">
                    {
                      entry.timeLabel
                    }
                  </td>
                  <td className="border border-black px-2 py-2 align-top">
                    {
                      entry.workCovered
                    }
                  </td>
                  <td className="whitespace-pre-line border border-black px-2 py-2 align-top">
                    {
                      entry.outcomesAchieved
                    }
                  </td>
                  <td className="border border-black px-2 py-2 align-top">
                    {
                      entry.deliveryMode
                    }
                  </td>
                  <td className="border border-black px-2 py-2 align-top">
                    {
                      entry.remarks ||
                      '—'
                    }
                  </td>
                  <td className="border border-black px-2 py-2 align-top">
                    {
                      entry.trainerSignature
                    }
                    <div className="mt-1 text-[8px]">
                      {
                        entry.signedAt
                          ? new Date(
                              entry.signedAt,
                            ).toLocaleString(
                              'en-GB',
                              {
                                timeZone:
                                  'Africa/Nairobi',
                              },
                            )
                          : ''
                      }
                    </div>
                  </td>
                  <td className="border border-black px-2 py-2 align-top">
                    {
                      entry.classRepresentativeName ||
                      '—'
                    }
                  </td>
                </tr>
              ),
            )
          )}
        </tbody>
      </table>

      <section className="mt-5 grid grid-cols-2 gap-8 text-[10px]">
        <div className="border-t border-black pt-2">
          <strong>HOD Review:</strong>{' '}
          Pending institutional review
        </div>
        <div className="border-t border-black pt-2">
          <strong>Quality Assurance:</strong>{' '}
          Pending institutional review
        </div>
      </section>
    </main>
  );
}
