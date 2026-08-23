import Image from 'next/image';

import {
  formatDailyReportDate,
  formatDailyReportTime,
  normalizeDailyReportDate,
} from '@/features/trainer-daily-report/domain';
import { getDepartmentDailyReports } from '@/features/trainer-daily-report/queries';

interface PageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function DailyReportsPrintPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const reportDate = normalizeDailyReportDate(params.date);
  const workspace = await getDepartmentDailyReports(reportDate);

  return (
    <main className="mx-auto max-w-[1500px] bg-white p-6 text-black print:max-w-none print:p-0">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 11mm;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .trainer-block {
            break-inside: avoid;
          }
        }
      `}</style>

      <p className="no-print mb-4 text-right text-xs text-gray-600">
        Use your browser Print command to save or share this report as PDF.
      </p>

      <header className="flex items-center gap-4 border-b-2 border-black pb-3">
        <Image
          src="/branding/icmhs-logo.png"
          alt="ICMHS logo"
          width={72}
          height={72}
          className="h-[72px] w-[72px] object-contain"
          priority
        />

        <div>
          <h1 className="text-lg font-bold uppercase">
            Imperial College of Medical &amp; Health Sciences
          </h1>
          <p className="mt-1 text-sm font-bold uppercase">
            Trainers Daily Report
          </p>
          <p className="mt-1 text-[11px]">
            {workspace.departmentName} · {formatDailyReportDate(reportDate)}
          </p>
        </div>
      </header>

      <table className="mt-4 w-full border-collapse text-[10px]">
        <tbody>
          <tr>
            <th className="border border-black bg-gray-100 px-2 py-1.5 text-left">
              Expected trainers
            </th>
            <td className="border border-black px-2 py-1.5">
              {workspace.summary.expectedTrainers}
            </td>
            <th className="border border-black bg-gray-100 px-2 py-1.5 text-left">
              Reports received
            </th>
            <td className="border border-black px-2 py-1.5">
              {workspace.summary.submittedReports}
            </td>
            <th className="border border-black bg-gray-100 px-2 py-1.5 text-left">
              Student absences
            </th>
            <td className="border border-black px-2 py-1.5">
              {workspace.summary.recordedAbsences}
            </td>
            <th className="border border-black bg-gray-100 px-2 py-1.5 text-left">
              Concerns
            </th>
            <td className="border border-black px-2 py-1.5">
              {workspace.summary.concerns}
            </td>
          </tr>
        </tbody>
      </table>

      {workspace.pendingTrainers.length > 0 ? (
        <section className="mt-4 border border-black p-3 text-[10px]">
          <strong>Pending reports:</strong>{' '}
          {workspace.pendingTrainers
            .map((item) => item.trainerName)
            .join(', ')}
        </section>
      ) : null}

      <div className="mt-5 space-y-5">
        {workspace.reports.map((report) => (
          <section
            key={report.reportId}
            className="trainer-block"
          >
            <div className="flex items-end justify-between border-b border-black pb-1">
              <div>
                <h2 className="text-[11px] font-bold uppercase">
                  {report.trainerName}
                </h2>
                <p className="text-[9px]">
                  {report.homeDepartmentName}
                  {report.trainerNumber ? ` · ${report.trainerNumber}` : ''}
                </p>
              </div>

              <p className="text-[8px]">
                Submitted:{' '}
                {new Date(report.submittedAt).toLocaleString('en-GB', {
                  timeZone: 'Africa/Nairobi',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>

            <table className="mt-2 w-full border-collapse text-[8.5px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black px-2 py-1.5 text-left">
                    Time
                  </th>
                  <th className="border border-black px-2 py-1.5 text-left">
                    Unit
                  </th>
                  <th className="border border-black px-2 py-1.5 text-left">
                    Class
                  </th>
                  <th className="border border-black px-2 py-1.5 text-center">
                    Present
                  </th>
                  <th className="border border-black px-2 py-1.5 text-center">
                    Absent
                  </th>
                  <th className="border border-black px-2 py-1.5 text-left">
                    Absentee students
                  </th>
                </tr>
              </thead>

              <tbody>
                {report.lessons.map((lesson) => (
                  <tr key={lesson.scheduledSessionId}>
                    <td className="whitespace-nowrap border border-black px-2 py-1.5 align-top">
                      {formatDailyReportTime(lesson.startsAt)}–
                      {formatDailyReportTime(lesson.endsAt)}
                    </td>
                    <td className="border border-black px-2 py-1.5 align-top">
                      {lesson.unitCode} · {lesson.unitName}
                    </td>
                    <td className="border border-black px-2 py-1.5 align-top">
                      {lesson.cohortName}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center align-top">
                      {lesson.presentCount}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center align-top">
                      {lesson.absentCount}
                    </td>
                    <td className="border border-black px-2 py-1.5 align-top">
                      {lesson.absentees.length > 0
                        ? lesson.absentees
                            .map(
                              (student) =>
                                `${student.fullName} (${student.admissionNumber})`,
                            )
                            .join('; ')
                        : 'None'}
                    </td>
                  </tr>
                ))}

                {report.lessons.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="border border-black px-2 py-2 text-center"
                    >
                      No scheduled lesson recorded for this department.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <table className="mt-2 w-full border-collapse text-[8.5px]">
              <tbody>
                <tr>
                  <th className="w-[18%] border border-black bg-gray-100 px-2 py-1.5 text-left align-top">
                    Other activity
                  </th>
                  <td className="w-[32%] whitespace-pre-line border border-black px-2 py-1.5 align-top">
                    {report.otherActivity || 'None reported'}
                  </td>

                  <th className="w-[18%] border border-black bg-gray-100 px-2 py-1.5 text-left align-top">
                    Concern / action required
                  </th>
                  <td className="w-[32%] whitespace-pre-line border border-black px-2 py-1.5 align-top">
                    {report.concern || 'None reported'}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <footer className="mt-7 grid grid-cols-2 gap-10 text-[9px]">
        <div className="border-t border-black pt-2">
          HOD review / signature
        </div>
        <div className="border-t border-black pt-2">
          Management comments
        </div>
      </footer>

      <p className="mt-4 text-right text-[8px] text-gray-600">
        Generated{' '}
        {new Date(workspace.generatedAt).toLocaleString('en-GB', {
          timeZone: 'Africa/Nairobi',
        })}
      </p>
    </main>
  );
}
