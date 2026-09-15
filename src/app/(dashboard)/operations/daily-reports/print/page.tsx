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

      <div className="no-print mb-4 flex items-center justify-between border-b pb-3 text-xs text-gray-600">
        <a
          href={`/api/operations/daily-reports/export-word?date=${reportDate}`}
          download
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
        >
          Download Word Document (.docx)
        </a>
        <p>Use your browser Print command (Ctrl+P / Cmd+P) to save or share as PDF.</p>
      </div>

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

            <table className="mt-2 w-full border-collapse text-[8.5px] table-fixed">
              <thead>
                <tr className="bg-gray-100">
                  <th className="w-[26%] border border-black px-2 py-1.5 text-left">
                    Unit & Time
                  </th>
                  <th className="w-[6%] border border-black px-2 py-1.5 text-center">
                    Present
                  </th>
                  <th className="w-[6%] border border-black px-2 py-1.5 text-center">
                    Absent
                  </th>
                  <th className="w-[62%] border border-black px-2 py-1.5 text-left">
                    Absentee Students
                  </th>
                </tr>
              </thead>

              <tbody>
                {report.lessons.map((lesson) => (
                  <tr key={lesson.scheduledSessionId}>
                    <td className="border border-black px-2 py-1.5 align-top">
                      <div className="font-bold">
                        {lesson.unitName}
                      </div>
                      {lesson.unitCode ? (
                        <div className="mt-0.5 font-mono text-[8px] font-semibold text-gray-800">
                          {lesson.unitCode}
                        </div>
                      ) : null}
                      <div className="mt-0.5 font-mono text-[7.5px] text-gray-700">
                        {formatDailyReportTime(lesson.startsAt)}–{formatDailyReportTime(lesson.endsAt)}
                      </div>
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center align-top font-mono">
                      {lesson.presentCount}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center align-top font-bold font-mono">
                      {lesson.absentCount}
                    </td>
                    <td className="border border-black px-2 py-1.5 align-top">
                      {lesson.absentees.length > 0 ? (
                        <div
                          className={`grid gap-x-3 gap-y-0.5 text-[8px] leading-tight ${
                            lesson.absentees.length > 20
                              ? 'grid-cols-4'
                              : lesson.absentees.length > 10
                              ? 'grid-cols-3'
                              : lesson.absentees.length > 4
                              ? 'grid-cols-2'
                              : 'grid-cols-1'
                          }`}
                        >
                          {lesson.absentees.map((student, idx) => (
                            <div
                              key={`${student.studentId || student.admissionNumber}-${idx}`}
                              className="flex items-start gap-1 py-0.2"
                            >
                              <span className="shrink-0 text-gray-700">•</span>
                              <div className="flex flex-wrap items-baseline gap-x-1">
                                <span className="font-semibold text-black">
                                  {student.fullName}
                                </span>
                                <span className="font-mono text-[7.5px] text-gray-700">
                                  ({student.admissionNumber})
                                </span>
                                {student.note ? (
                                  <span className="text-[7px] italic text-gray-600">
                                    [{student.note}]
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="italic text-gray-600">None (100% Present)</span>
                      )}
                    </td>
                  </tr>
                ))}

                {report.lessons.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
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
