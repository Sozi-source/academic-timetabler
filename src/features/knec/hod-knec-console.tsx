'use client';

import { useActionState, useId, useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  KeyRound,
  Search,
  Upload,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  batchUpdateSeriesKnecIndexNumbersAction,
  createKnecExamSeriesAction,
  importBulkKnecIndexNumbersAction,
  importHistoricalKnecExcelAction,
  recordKnecBookingPaperResultsAction,
  updateKnecBookingStatusAction,
  updateKnecExamSeriesStatusAction,
  updateStudentKnecDetailsAction,
  type HodKnecActionState,
} from './actions';
import type { HodKnecDashboardData } from './queries';
import type {
  KnecBookingRecord,
  KnecBookingStatus,
  KnecExamSeriesStatus,
  KnecModuleStatus,
  KnecPaperResultStatus,
  StudentKnecSummary,
} from './types';

interface HodKnecConsoleProps {
  data: HodKnecDashboardData;
}

const initialImportState: HodKnecActionState = { status: 'idle', message: null };

function overallBadgeVariant(status: StudentKnecSummary['overallStatus']) {
  if (status === 'completed') return 'success' as const;
  if (status === 'booked') return 'institutional' as const;
  if (status === 'resit_pending') return 'warning' as const;
  return 'neutral' as const;
}

function overallStatusLabel(status: StudentKnecSummary['overallStatus']) {
  switch (status) {
    case 'completed':
      return 'KNEC Completed';
    case 'booked':
      return 'Booked in Series';
    case 'resit_pending':
      return 'Resit Pending';
    case 'in_progress':
      return 'In Progress';
    default:
      return 'Not Started';
  }
}

function seriesBadgeVariant(status: KnecExamSeriesStatus) {
  if (status === 'booking_open') return 'success' as const;
  if (status === 'in_progress') return 'institutional' as const;
  if (status === 'results_released') return 'neutral' as const;
  return 'warning' as const;
}

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function HodKnecConsole({ data }: HodKnecConsoleProps) {
  const searchId = useId();
  const seriesMonthId = useId();
  const seriesYearId = useId();
  const seriesStatusId = useId();
  const importFileId = useId();
  const bulkIndexFileId = useId();
  const bulkIndexSeriesId = useId();

  const [activeTab, setActiveTab] = useState<'progress' | 'bookings' | 'catalog'>('progress');
  const [searchQuery, setSearchQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [deptStatusFilter, setDeptStatusFilter] = useState<string>('all');
  const [knecStatusFilter, setKnecStatusFilter] = useState<string>('all');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(data.series[0]?.id ?? 'all');

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<HodKnecActionState>({ status: 'idle', message: null });
  const [isPending, startTransition] = useTransition();

  const [bulkIndexEditMode, setBulkIndexEditMode] = useState(false);
  const [draftBatchIndices, setDraftBatchIndices] = useState<Record<string, string>>({});
  const [markBatchRegistered, setMarkBatchRegistered] = useState(true);

  const [importState, importAction, isImporting] = useActionState(
    importHistoricalKnecExcelAction,
    initialImportState,
  );
  const [indexImportState, indexImportAction, isImportingIndex] = useActionState(
    importBulkKnecIndexNumbersAction,
    initialImportState,
  );

  // Student drawer local edit states
  const editingStudent = useMemo(
    () => data.students.find((s) => s.studentId === editingStudentId) ?? null,
    [data.students, editingStudentId],
  );
  const [draftIndexNumber, setDraftIndexNumber] = useState('');
  const [draftModuleStatuses, setDraftModuleStatuses] = useState<Record<string, KnecModuleStatus>>({});
  const [draftResitPapers, setDraftResitPapers] = useState<Record<string, string[]>>({});

  // Booking drawer local edit states
  const allBookings = useMemo(() => {
    const out: Array<KnecBookingRecord & { student: StudentKnecSummary }> = [];
    for (const s of data.students) {
      for (const b of s.bookings) {
        out.push({ ...b, student: s });
      }
    }
    return out.sort((a, b) => b.seriesYear - a.seriesYear || a.student.fullName.localeCompare(b.student.fullName));
  }, [data.students]);

  const editingBooking = useMemo(
    () => allBookings.find((b) => b.id === editingBookingId) ?? null,
    [allBookings, editingBookingId],
  );
  const [draftBookingStatus, setDraftBookingStatus] = useState<KnecBookingStatus>('submitted');
  const [draftBookingIndex, setDraftBookingIndex] = useState('');
  const [draftPaperResults, setDraftPaperResults] = useState<
    Record<string, { paperStatus: KnecPaperResultStatus; grade: string }>
  >({});

  function openStudentModal(stu: StudentKnecSummary) {
    setFeedback({ status: 'idle', message: null });
    setDraftIndexNumber(stu.knecIndexNumber ?? '');
    const statuses: Record<string, KnecModuleStatus> = {};
    const resits: Record<string, string[]> = {};
    for (const m of stu.modules) {
      statuses[m.module.id] = m.status;
      resits[m.module.id] = [...m.resitPaperCodes];
    }
    setDraftModuleStatuses(statuses);
    setDraftResitPapers(resits);
    setEditingStudentId(stu.studentId);
  }

  function openBookingModal(booking: KnecBookingRecord & { student: StudentKnecSummary }) {
    setFeedback({ status: 'idle', message: null });
    setDraftBookingStatus(booking.bookingStatus);
    setDraftBookingIndex(booking.knecIndexNumber ?? booking.student.knecIndexNumber ?? '');
    const paperMap: Record<string, { paperStatus: KnecPaperResultStatus; grade: string }> = {};
    for (const p of booking.papers) {
      paperMap[p.id] = { paperStatus: p.paperStatus, grade: p.grade ?? '' };
    }
    setDraftPaperResults(paperMap);
    setEditingBookingId(booking.id);
  }

  // Stats
  const stats = useMemo(() => {
    let completed = 0;
    let booked = 0;
    let resit = 0;
    let pending = 0;
    for (const s of data.students) {
      if (s.overallStatus === 'completed') completed += 1;
      else if (s.overallStatus === 'booked') booked += 1;
      else if (s.overallStatus === 'resit_pending') resit += 1;
      else pending += 1;
    }
    return {
      total: data.students.length,
      completed,
      booked,
      resit,
      pending,
    };
  }, [data.students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.students.filter((s) => {
      if (q) {
        const hit =
          s.fullName.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          (s.knecIndexNumber ?? '').toLowerCase().includes(q) ||
          (s.cohortName ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      if (trackFilter !== 'all') {
        if (trackFilter === 'CHN_CND' && !['CHN', 'CND'].includes(s.programmeCode)) return false;
        if (trackFilter === 'DHN_DND' && !['DHN', 'DND'].includes(s.programmeCode)) return false;
        if (trackFilter === 'DHNT_DNDT' && !['DHNT', 'DNDT'].includes(s.programmeCode)) return false;
        if (trackFilter === 'DFP_DFPT' && !['DFP', 'DFPT'].includes(s.programmeCode)) return false;
      }

      if (deptStatusFilter !== 'all') {
        if (deptStatusFilter === 'in_class' && !(s.lifecycleStatus === 'active' && s.academicPhase === 'in_class')) {
          return false;
        }
        if (deptStatusFilter === 'attachment' && s.academicPhase !== 'attachment') return false;
        if (deptStatusFilter === 'awaiting_graduation' && s.academicPhase !== 'awaiting_graduation') return false;
        if (deptStatusFilter === 'graduated' && s.lifecycleStatus !== 'graduated') return false;
      }

      if (knecStatusFilter !== 'all' && s.overallStatus !== knecStatusFilter) return false;

      return true;
    });
  }, [data.students, deptStatusFilter, knecStatusFilter, searchQuery, trackFilter]);

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allBookings.filter((b) => {
      if (selectedSeriesId !== 'all' && b.seriesId !== selectedSeriesId) return false;
      if (q) {
        const hit =
          b.student.fullName.toLowerCase().includes(q) ||
          b.student.admissionNumber.toLowerCase().includes(q) ||
          (b.knecIndexNumber ?? b.student.knecIndexNumber ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [allBookings, searchQuery, selectedSeriesId]);

  function startBulkIndexEdit() {
    const initial: Record<string, string> = {};
    for (const b of filteredBookings) {
      initial[b.student.admissionNumber] = b.knecIndexNumber ?? b.student.knecIndexNumber ?? '';
    }
    setDraftBatchIndices(initial);
    setBulkIndexEditMode(true);
  }

  function handleSaveBatchIndices() {
    const entries = Object.entries(draftBatchIndices)
      .map(([admissionNumber, knecIndexNumber]) => ({
        admissionNumber,
        knecIndexNumber: knecIndexNumber.trim(),
      }))
      .filter((entry) => entry.knecIndexNumber.length > 0);

    startTransition(async () => {
      const res = await batchUpdateSeriesKnecIndexNumbersAction({
        seriesId: selectedSeriesId,
        markBookingsRegistered: markBatchRegistered,
        entries,
      });
      setFeedback(res);
      if (res.status === 'success') {
        setBulkIndexEditMode(false);
      }
    });
  }

  function handleExportProgressCsv() {
    const headers = [
      'Admission No',
      'Student Name',
      'Programme',
      'Cohort',
      'KNEC Index No',
      'Dept Status',
      'Required Modules',
      'Completed Modules',
      'Pending/Resit Modules',
      'Active Booked Series',
      'Completion %',
      'Overall KNEC Status',
    ];
    const lines = filteredStudents.map((s) => {
      const req = s.modules.map((m) => m.module.moduleCode).join('; ');
      const done = s.modules.filter((m) => m.status === 'completed').map((m) => m.module.moduleCode).join('; ');
      const open = s.modules
        .filter((m) => m.status === 'pending' || m.status === 'resit' || m.status === 'booked')
        .map((m) => (m.status === 'resit' ? `${m.module.moduleCode} (resit)` : m.module.moduleCode))
        .join('; ');
      const activeSeries = Array.from(
        new Set(s.modules.map((m) => m.activeSeriesName).filter(Boolean)),
      ).join('; ');

      return [
        `"${s.admissionNumber}"`,
        `"${s.fullName.replace(/"/g, '""')}"`,
        `"${s.programmeCode}"`,
        `"${(s.cohortName ?? '').replace(/"/g, '""')}"`,
        `"${s.knecIndexNumber ?? ''}"`,
        `"${s.academicPhase || s.lifecycleStatus}"`,
        `"${req}"`,
        `"${done}"`,
        `"${open}"`,
        `"${activeSeries}"`,
        `${s.completionPercent}%`,
        `"${overallStatusLabel(s.overallStatus)}"`,
      ].join(',');
    });
    downloadCsv('KNEC_Student_Progress.csv', [headers.join(','), ...lines].join('\n'));
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-3.5 border-border shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Tracked Students</p>
          <p className="mt-1 text-xl font-extrabold text-text-primary">{stats.total}</p>
        </Card>
        <Card className="p-3.5 border-border shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">KNEC Completed</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-800">{stats.completed}</p>
        </Card>
        <Card className="p-3.5 border-border shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Booked in Series</p>
          <p className="mt-1 text-xl font-extrabold text-sky-900">{stats.booked}</p>
        </Card>
        <Card className="p-3.5 border-border shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Resit Pending</p>
          <p className="mt-1 text-xl font-extrabold text-amber-800">{stats.resit}</p>
        </Card>
        <Card className="p-3.5 border-border shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Pending / In Progress</p>
          <p className="mt-1 text-xl font-extrabold text-text-primary">{stats.pending}</p>
        </Card>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-3 shadow-2xs">
        <div role="tablist" aria-label="KNEC management views" className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'progress'}
            onClick={() => setActiveTab('progress')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'progress' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Award className="size-3.5" aria-hidden="true" />
            <span>Student KNEC Progress ({filteredStudents.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bookings'}
            onClick={() => setActiveTab('bookings')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'bookings' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            <span>Series &amp; Bookings ({allBookings.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'catalog'}
            onClick={() => setActiveTab('catalog')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              activeTab === 'catalog' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            <span>Historical Import &amp; Paper Catalog</span>
          </button>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={handleExportProgressCsv}>
          <Download className="size-3.5" aria-hidden="true" />
          <span>Export Progress CSV</span>
        </Button>
      </div>

      {/* Feedback Banner */}
      <div aria-live="polite">
        {feedback.status !== 'idle' && feedback.message ? (
          <div
            className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center justify-between ${
              feedback.status === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback({ status: 'idle', message: null })}
              aria-label="Dismiss notification"
              className="p-1 hover:opacity-70"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* TAB 1: STUDENT PROGRESS MATRIX */}
      {activeTab === 'progress' ? (
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-border bg-white p-3.5 shadow-2xs">
            <div className="relative">
              <label htmlFor={searchId} className="sr-only">
                Search student, admission or KNEC index
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                id={searchId}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, admission, index..."
                className="h-9 w-full rounded-lg border border-border bg-white pl-8 pr-3 text-xs"
              />
            </div>
            <select
              aria-label="Filter by programme track"
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-medium"
            >
              <option value="all">All KNEC Tracks</option>
              <option value="CHN_CND">CHN / CND (1905 Cert)</option>
              <option value="DHN_DND">DHN / DND (2916 Diploma)</option>
              <option value="DHNT_DNDT">DHNT / DNDT (Transition Mod II &amp; III)</option>
              <option value="DFP_DFPT">DFP / DFPT (Food Processing)</option>
            </select>
            <select
              aria-label="Filter by department status"
              value={deptStatusFilter}
              onChange={(e) => setDeptStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-medium"
            >
              <option value="all">All Dept Statuses</option>
              <option value="in_class">In Class</option>
              <option value="attachment">On Attachment</option>
              <option value="awaiting_graduation">Awaiting Graduation</option>
              <option value="graduated">Graduated</option>
            </select>
            <select
              aria-label="Filter by KNEC completion status"
              value={knecStatusFilter}
              onChange={(e) => setKnecStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-medium"
            >
              <option value="all">All KNEC Statuses</option>
              <option value="completed">KNEC Completed</option>
              <option value="booked">Booked in Series</option>
              <option value="resit_pending">Resit Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="not_started">Not Started</option>
            </select>
          </div>

          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">No.</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Index No.</TableHead>
                  <TableHead>Dept Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Pending / Resit</TableHead>
                  <TableHead>Series Booked</TableHead>
                  <TableHead>KNEC Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.slice(0, 150).map((stu, idx) => {
                  const openMods = stu.modules
                    .filter((m) => m.status === 'pending' || m.status === 'resit')
                    .map((m) => (m.status === 'resit' ? `${m.module.moduleCode} (Resit)` : m.module.moduleCode));
                  const activeSeries = Array.from(
                    new Set(stu.modules.map((m) => m.activeSeriesName).filter(Boolean)),
                  );

                  return (
                    <TableRow key={stu.studentId}>
                      <TableCell className="text-center text-slate-400">{idx + 1}.</TableCell>
                      <TableCell className="font-mono font-bold text-slate-900">{stu.admissionNumber}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{stu.fullName}</TableCell>
                      <TableCell>{stu.programmeCode}</TableCell>
                      <TableCell className="font-mono">
                        {stu.knecIndexNumber ? (
                          stu.knecIndexNumber
                        ) : (stu.missingProfileFields?.length ?? 0) > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 text-amber-700"
                            title={`Missing Module I biodata: ${stu.missingProfileFields?.join(', ')}`}
                          >
                            <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                            <span>Biodata Pending</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{stu.academicPhase.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="font-mono font-bold">
                        {stu.completedCount}/{stu.requiredCount} ({stu.completionPercent}%)
                      </TableCell>
                      <TableCell>{openMods.length > 0 ? openMods.join('; ') : '—'}</TableCell>
                      <TableCell>{activeSeries.length > 0 ? activeSeries.join(', ') : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={overallBadgeVariant(stu.overallStatus)}>
                          {overallStatusLabel(stu.overallStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => openStudentModal(stu)}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <span>Open</span>
                          <ArrowUpRight className="size-3" aria-hidden="true" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {filteredStudents.length > 150 ? (
            <p className="text-[11px] text-text-muted">
              Showing first 150 of {filteredStudents.length} matching records. Use search or filters to narrow down.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* TAB 2: SERIES MANAGER & BOOKINGS */}
      {activeTab === 'bookings' ? (
        <div className="space-y-5">
          {/* Create & Manage Exam Series */}
          <Card className="p-4 border-border shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <CalendarPlus className="size-4 text-primary" aria-hidden="true" />
                <span>KNEC Examination Series Registry</span>
              </h2>
            </div>

            <form
              action={(fd) => {
                startTransition(async () => {
                  const res = await createKnecExamSeriesAction(fd);
                  setFeedback(res);
                });
              }}
              className="grid gap-3 sm:grid-cols-4 items-end rounded-xl border border-border bg-slate-50/70 p-3"
            >
              <div>
                <label htmlFor={seriesMonthId} className="block text-[11px] font-bold text-text-primary mb-1">
                  Series Month
                </label>
                <select
                  id={seriesMonthId}
                  name="seriesMonth"
                  defaultValue="July"
                  className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-medium"
                >
                  <option value="March">March</option>
                  <option value="July">July</option>
                  <option value="November">November</option>
                </select>
              </div>
              <div>
                <label htmlFor={seriesYearId} className="block text-[11px] font-bold text-text-primary mb-1">
                  Year
                </label>
                <input
                  id={seriesYearId}
                  name="seriesYear"
                  type="number"
                  min={2020}
                  max={2050}
                  defaultValue={2027}
                  required
                  className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor={seriesStatusId} className="block text-[11px] font-bold text-text-primary mb-1">
                  Window Status
                </label>
                <select
                  id={seriesStatusId}
                  name="status"
                  defaultValue="booking_open"
                  className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-medium"
                >
                  <option value="planned">Planned</option>
                  <option value="booking_open">Booking Open</option>
                  <option value="booking_closed">Booking Closed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="results_released">Results Released</option>
                </select>
              </div>
              <Button type="submit" disabled={isPending} size="sm" className="h-9">
                Save / Open Series
              </Button>
            </form>

            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Series Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Current Status</TableHead>
                    <TableHead>Candidates Booked</TableHead>
                    <TableHead className="text-right">Change Window Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.series.map((s) => {
                    const count = allBookings.filter((b) => b.seriesId === s.id && b.bookingStatus !== 'cancelled').length;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-bold text-slate-900">{s.seriesName}</TableCell>
                        <TableCell className="font-mono">{s.seriesCode}</TableCell>
                        <TableCell>
                          <Badge variant={seriesBadgeVariant(s.status)}>{s.status.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="font-mono font-bold">{count}</TableCell>
                        <TableCell className="text-right">
                          <select
                            aria-label={`Change status for ${s.seriesName}`}
                            value={s.status}
                            disabled={isPending}
                            onChange={(e) => {
                              const nextStatus = e.target.value as KnecExamSeriesStatus;
                              startTransition(async () => {
                                const res = await updateKnecExamSeriesStatusAction({
                                  seriesId: s.id,
                                  status: nextStatus,
                                });
                                setFeedback(res);
                              });
                            }}
                            className="h-7 rounded border border-border bg-white px-2 text-xs"
                          >
                            <option value="planned">Planned</option>
                            <option value="booking_open">Booking Open</option>
                            <option value="booking_closed">Booking Closed</option>
                            <option value="in_progress">In Progress</option>
                            <option value="results_released">Results Released</option>
                            <option value="archived">Archived</option>
                          </select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          {/* Registrar KNEC Portal Export & Bulk Index Number Assignment */}
          <Card className="p-4 border-border shadow-2xs space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" aria-hidden="true" />
                  <span>KNEC Portal Registration Roll &amp; Issued Index Numbers</span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Export candidates (including confidential KCSE Index, ID, Phone &amp; Birth Cert Entry No.) for KNEC portal registration, then upload or batch-enter the issued KNEC Index Numbers.
                </p>
              </div>
              <a
                href={`/api/assessment/knec/export-roll?seriesId=${encodeURIComponent(selectedSeriesId)}`}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50"
              >
                <Download className="size-3.5 text-primary" aria-hidden="true" />
                <span>Download KNEC Registration Roll (.xlsx)</span>
              </a>
            </div>

            <form
              action={indexImportAction}
              className="grid gap-3 border-t border-border-soft pt-3 md:grid-cols-12 md:items-end"
            >
              <div className="md:col-span-3">
                <label htmlFor={bulkIndexSeriesId} className="block text-[11px] font-bold text-slate-700 mb-1">
                  Target Exam Series (optional)
                </label>
                <select
                  id={bulkIndexSeriesId}
                  name="seriesId"
                  defaultValue={selectedSeriesId}
                  className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-medium"
                >
                  <option value="all">Update Student Profile Only (All Series)</option>
                  {data.series.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.seriesName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-5">
                <label htmlFor={bulkIndexFileId} className="block text-[11px] font-bold text-slate-700 mb-1">
                  Upload Issued Index Sheet (.xlsx / .csv with Admission No. &amp; KNEC Index Number)
                </label>
                <input
                  id={bulkIndexFileId}
                  name="file"
                  type="file"
                  accept=".xlsx,.csv"
                  required
                  className="block w-full text-xs text-slate-700 file:mr-2.5 file:rounded-md file:border file:border-border file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold"
                />
              </div>
              <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    name="markBookingsRegistered"
                    value="true"
                    defaultChecked
                    className="size-3.5 accent-[#0b4f4a]"
                  />
                  <span>Mark booked rows Registered</span>
                </label>
                <Button type="submit" size="sm" disabled={isImportingIndex}>
                  <Upload className="size-3.5" aria-hidden="true" />
                  <span>{isImportingIndex ? 'Applying...' : 'Upload Index Numbers'}</span>
                </Button>
              </div>
            </form>

            <div aria-live="polite" role="status">
              {indexImportState.status !== 'idle' && indexImportState.message ? (
                <p
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    indexImportState.status === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  {indexImportState.message}
                </p>
              ) : null}
            </div>
          </Card>

          {/* Bookings Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter bookings by KNEC series"
                  value={selectedSeriesId}
                  onChange={(e) => setSelectedSeriesId(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-bold"
                >
                  <option value="all">All Exam Series</option>
                  {data.series.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.seriesName}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter candidate or index no..."
                  className="h-9 rounded-lg border border-border bg-white px-3 text-xs min-w-[220px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {bulkIndexEditMode ? (
                  <>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 mr-1">
                      <input
                        type="checkbox"
                        checked={markBatchRegistered}
                        onChange={(e) => setMarkBatchRegistered(e.target.checked)}
                        className="size-3.5 accent-[#0b4f4a]"
                      />
                      <span>Mark Registered</span>
                    </label>
                    <Button type="button" size="sm" disabled={isPending} onClick={handleSaveBatchIndices}>
                      {isPending ? 'Saving...' : 'Save All Index Numbers'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => setBulkIndexEditMode(false)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={filteredBookings.length === 0}
                    onClick={startBulkIndexEdit}
                  >
                    <KeyRound className="size-3.5" aria-hidden="true" />
                    <span>Batch Enter Index Numbers</span>
                  </Button>
                )}
              </div>
            </div>

            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">No.</TableHead>
                    <TableHead>Series</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Index No.</TableHead>
                    <TableHead>Modules / Papers</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((b, idx) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-center text-slate-400">{idx + 1}.</TableCell>
                      <TableCell className="font-semibold">{b.seriesName}</TableCell>
                      <TableCell className="font-mono font-bold">{b.student.admissionNumber}</TableCell>
                      <TableCell className="font-semibold">{b.student.fullName}</TableCell>
                      <TableCell>{b.student.programmeCode}</TableCell>
                      <TableCell className="font-mono">
                        {bulkIndexEditMode ? (
                          <input
                            type="text"
                            aria-label={`KNEC index number for ${b.student.fullName}`}
                            value={draftBatchIndices[b.student.admissionNumber] ?? ''}
                            onChange={(e) =>
                              setDraftBatchIndices((prev) => ({
                                ...prev,
                                [b.student.admissionNumber]: e.target.value,
                              }))
                            }
                            placeholder="e.g. 40210045012"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            maxLength={40}
                            className="h-7 w-36 rounded border border-border bg-white px-2 font-mono text-xs"
                          />
                        ) : (
                          b.knecIndexNumber ?? b.student.knecIndexNumber ?? '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {Array.from(new Set(b.papers.map((p) => p.moduleCode))).join(', ')} ({b.papers.length})
                      </TableCell>
                      <TableCell className="uppercase">{b.bookingType}</TableCell>
                      <TableCell>
                        <Badge variant="institutional">{b.bookingStatus.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={`/api/student/knec/form?studentId=${encodeURIComponent(b.studentId)}&bookingId=${encodeURIComponent(b.id)}`}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            title="Download clearance PDF"
                          >
                            <Download className="size-3" aria-hidden="true" />
                            <span>PDF</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => openBookingModal(b)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="size-3" aria-hidden="true" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </div>
      ) : null}

      {/* TAB 3: HISTORICAL EXCEL IMPORT & CATALOG */}
      {activeTab === 'catalog' ? (
        <div className="space-y-5">
          <Card className="p-4 sm:p-5 border-border shadow-2xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Upload className="size-4 text-primary" aria-hidden="true" />
                <span>Import / Sync Historical KNEC Progress Workbook (.xlsx)</span>
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Upload an updated KNEC Progress sheet matching <code>Students KNEC Progress.xlsx</code> to backfill pending/completed modules and series registrations.
              </p>
            </div>

            <form action={importAction} className="space-y-3 max-w-xl">
              <div>
                <label htmlFor={importFileId} className="block text-xs font-bold text-text-primary mb-1">
                  KNEC Progress Excel File (.xlsx)
                </label>
                <input
                  id={importFileId}
                  name="file"
                  type="file"
                  accept=".xlsx"
                  required
                  className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border file:border-border file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="init-omitted-completed"
                  type="checkbox"
                  name="initializeOmittedCompleted"
                  value="true"
                  defaultChecked
                  className="size-4 accent-[#0b4f4a]"
                />
                <label htmlFor="init-omitted-completed" className="text-xs text-text-secondary">
                  Mark graduated/completed students omitted from Pending sheet as KNEC Completed
                </label>
              </div>
              <div aria-live="polite">
                {importState.status !== 'idle' && importState.message ? (
                  <p
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      importState.status === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-rose-200 bg-rose-50 text-rose-900'
                    }`}
                  >
                    {importState.message}
                  </p>
                ) : null}
              </div>
              <Button type="submit" disabled={isImporting} size="sm">
                {isImporting ? 'Importing...' : 'Upload & Sync KNEC Progress'}
              </Button>
            </form>
          </Card>

          <Card className="p-4 sm:p-5 border-border shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-text-primary">Seeded KNEC Modules &amp; Paper Catalog</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {data.modules
                .filter((m) => m.papers.length > 0)
                .map((mod) => (
                  <div key={mod.id} className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-slate-50 border-b border-border px-3.5 py-2 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">
                        {mod.moduleCode} · {mod.title}
                      </span>
                      <Badge variant="neutral">{mod.papers.length} papers</Badge>
                    </div>
                    <div className="divide-y divide-border-soft bg-white">
                      {mod.papers.map((p) => (
                        <div key={p.id} className="px-3.5 py-2 text-xs flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-slate-900">{p.paperCode}</span>{' '}
                            <span className="text-slate-700">{p.paperName}</span>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold uppercase text-slate-500">
                            {p.paperType.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      ) : null}

      {/* MODAL 1: EDIT STUDENT KNEC MODULES & INDEX NUMBER */}
      {editingStudent ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-knec-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 id="student-knec-dialog-title" className="text-sm font-extrabold text-slate-900">
                  {editingStudent.fullName} · {editingStudent.admissionNumber}
                </h2>
                <p className="text-xs text-slate-500">{editingStudent.equivalentTrackLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudentId(null)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              {(editingStudent.missingProfileFields?.length ?? 0) > 0 ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-amber-700" aria-hidden="true" />
                    <span>Module I KNEC Biodata Incomplete</span>
                  </p>
                  <p className="mt-1 text-amber-900">
                    Missing in Student Profile: <strong>{editingStudent.missingProfileFields?.join(', ')}</strong>.
                  </p>
                </div>
              ) : null}

              <div>
                <label htmlFor="hod-student-index" className="block text-xs font-bold text-slate-800 mb-1">
                  KNEC Index Number
                </label>
                <input
                  id="hod-student-index"
                  type="text"
                  value={draftIndexNumber}
                  onChange={(e) => setDraftIndexNumber(e.target.value)}
                  placeholder="Enter KNEC index number"
                  className="h-9 w-full rounded-lg border border-border px-3 text-xs font-mono"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-800">Module Progression &amp; Resits</p>
                {editingStudent.modules.map((m) => {
                  const curStatus = draftModuleStatuses[m.module.id] ?? m.status;
                  const curResits = draftResitPapers[m.module.id] ?? m.resitPaperCodes;
                  return (
                    <div key={m.module.id} className="rounded-xl border border-border p-3 space-y-2 bg-slate-50/50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {m.module.moduleCode} · {m.module.title}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Source: {m.completionSource.replace('_', ' ')}
                          </p>
                        </div>
                        <select
                          aria-label={`Status for ${m.module.moduleCode}`}
                          value={curStatus}
                          onChange={(e) =>
                            setDraftModuleStatuses((prev) => ({
                              ...prev,
                              [m.module.id]: e.target.value as KnecModuleStatus,
                            }))
                          }
                          className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs font-bold"
                        >
                          <option value="completed">Completed</option>
                          <option value="booked">Booked</option>
                          <option value="resit">Resit Required</option>
                          <option value="pending">Pending</option>
                          <option value="exempt">Exempt</option>
                        </select>
                      </div>

                      {curStatus === 'resit' && m.module.papers.length > 0 ? (
                        <div className="pt-1 flex flex-wrap gap-2">
                          {m.module.papers.map((paper) => {
                            const checked = curResits.includes(paper.paperCode);
                            return (
                              <label
                                key={paper.id}
                                className="inline-flex items-center gap-1.5 rounded border border-border bg-white px-2 py-1 text-[11px] font-mono cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setDraftResitPapers((prev) => {
                                      const list = prev[m.module.id] ?? [];
                                      return {
                                        ...prev,
                                        [m.module.id]: checked
                                          ? list.filter((c) => c !== paper.paperCode)
                                          : [...list, paper.paperCode],
                                      };
                                    })
                                  }
                                  className="accent-[#0b4f4a]"
                                />
                                <span>{paper.paperCode}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingStudentId(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await updateStudentKnecDetailsAction({
                      studentId: editingStudent.studentId,
                      knecIndexNumber: draftIndexNumber,
                      moduleUpdates: editingStudent.modules.map((m) => ({
                        moduleId: m.module.id,
                        status: draftModuleStatuses[m.module.id] ?? m.status,
                        resitPaperCodes: draftResitPapers[m.module.id] ?? [],
                      })),
                    });
                    setFeedback(res);
                    if (res.status === 'success') setEditingStudentId(null);
                  });
                }}
              >
                {isPending ? 'Saving...' : 'Save KNEC Progress'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL 2: VERIFY BOOKING & RECORD PAPER RESULTS */}
      {editingBooking ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-knec-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 id="booking-knec-dialog-title" className="text-sm font-extrabold text-slate-900">
                  {editingBooking.student.fullName} · {editingBooking.seriesName}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingBooking.student.admissionNumber} · {editingBooking.clearanceRef ?? ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingBookingId(null)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="booking-index-input" className="block text-xs font-bold text-slate-800 mb-1">
                  Booking KNEC Index No.
                </label>
                <input
                  id="booking-index-input"
                  type="text"
                  value={draftBookingIndex}
                  onChange={(e) => setDraftBookingIndex(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border px-3 text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor="booking-status-select" className="block text-xs font-bold text-slate-800 mb-1">
                  Booking / Clearance Status
                </label>
                <select
                  id="booking-status-select"
                  value={draftBookingStatus}
                  onChange={(e) => setDraftBookingStatus(e.target.value as KnecBookingStatus)}
                  className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-bold"
                >
                  <option value="submitted">Submitted</option>
                  <option value="hod_cleared">HOD Cleared</option>
                  <option value="registered_knec">Registered with KNEC</option>
                  <option value="sat">Sat Examination</option>
                  <option value="results_recorded">Results Recorded</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await updateKnecBookingStatusAction({
                      bookingId: editingBooking.id,
                      bookingStatus: draftBookingStatus,
                      knecIndexNumber: draftBookingIndex,
                    });
                    setFeedback(res);
                  });
                }}
              >
                Update Clearance Status &amp; Index
              </Button>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800">Papers Registered &amp; Results</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next: Record<string, { paperStatus: KnecPaperResultStatus; grade: string }> = {};
                    for (const p of editingBooking.papers) {
                      next[p.id] = { paperStatus: 'passed', grade: draftPaperResults[p.id]?.grade || 'PASS' };
                    }
                    setDraftPaperResults(next);
                  }}
                >
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  <span>Mark All Passed</span>
                </Button>
              </div>

              <div className="divide-y divide-border-soft rounded-xl border border-border">
                {editingBooking.papers.map((p) => {
                  const cur = draftPaperResults[p.id] ?? { paperStatus: p.paperStatus, grade: p.grade ?? '' };
                  return (
                    <div key={p.id} className="p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-bold text-slate-900">{p.paperCode}</span>{' '}
                        <span className="text-slate-700">{p.paperName}</span>
                        {p.isResit ? (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-900">
                            Resit
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          aria-label={`Result status for ${p.paperCode}`}
                          value={cur.paperStatus}
                          onChange={(e) =>
                            setDraftPaperResults((prev) => ({
                              ...prev,
                              [p.id]: { ...cur, paperStatus: e.target.value as KnecPaperResultStatus },
                            }))
                          }
                          className="h-8 rounded border border-border bg-white px-2 text-xs"
                        >
                          <option value="booked">Booked</option>
                          <option value="sat">Sat</option>
                          <option value="passed">Passed</option>
                          <option value="referred">Referred (Resit)</option>
                          <option value="absent">Absent</option>
                        </select>
                        <input
                          aria-label={`Grade for ${p.paperCode}`}
                          type="text"
                          value={cur.grade}
                          onChange={(e) =>
                            setDraftPaperResults((prev) => ({
                              ...prev,
                              [p.id]: { ...cur, grade: e.target.value },
                            }))
                          }
                          placeholder="Grade"
                          className="h-8 w-20 rounded border border-border px-2 text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <a
                href={`/api/student/knec/form?studentId=${encodeURIComponent(editingBooking.studentId)}&bookingId=${encodeURIComponent(editingBooking.id)}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="size-3.5" aria-hidden="true" />
                <span>Download Clearance PDF</span>
              </a>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingBookingId(null)}>
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await recordKnecBookingPaperResultsAction({
                        bookingId: editingBooking.id,
                        papers: editingBooking.papers.map((p) => ({
                          paperRecordId: p.id,
                          paperStatus: draftPaperResults[p.id]?.paperStatus ?? p.paperStatus,
                          grade: draftPaperResults[p.id]?.grade ?? p.grade,
                        })),
                      });
                      setFeedback(res);
                      if (res.status === 'success') setEditingBookingId(null);
                    });
                  }}
                >
                  {isPending ? 'Saving...' : 'Save Paper Results & Sync Modules'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
