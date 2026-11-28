import type {
  KnecBookingRecord,
  KnecModuleItem,
  KnecModuleStatus,
  KnecOverallCompletionStatus,
  StudentKnecModuleProgressItem,
} from './types';

export function canonicalKnecTrackLabel(programmeCode: string | null | undefined): string {
  const code = (programmeCode ?? '').trim().toUpperCase();
  if (code === 'CHN' || code === 'CND') return 'Certificate in Nutrition & Dietetics (1905)';
  if (code === 'DHN' || code === 'DND') return 'Diploma in Nutrition & Dietetics (2916)';
  if (code === 'DHNT' || code === 'DNDT') {
    return 'Diploma Transition (1905 Cert Modules + 2916 Mod II & III)';
  }
  if (code === 'DFP') return 'Diploma in Food Processing (2913)';
  if (code === 'DFPT') return 'Food Processing Transition (1903 + 2913 Mod II & III)';
  return code || 'KNEC Track';
}

export function normalizeKnecSeriesCode(month: string, year: number): string {
  const m = month.trim().slice(0, 3).toUpperCase();
  return `${m}-${year}`;
}

export interface ParsedHistoricalKnecRow {
  admissionNumber: string;
  studentName: string;
  programmeCode: string;
  cohortName: string;
  deptStatus: string;
  requiredModules: string[];
  pendingModules: Array<{ moduleCode: string; isResit: boolean }>;
  registeredNov2026Modules: string[];
  notYetModules: Array<{ moduleCode: string; isResit: boolean }>;
  nov2026PapersByModule: Record<string, string[]>;
  actionLabel: string;
}

function splitSemicolonTokens(value: string): string[] {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Parses module lists from Students KNEC Progress.xlsx such as:
 * - "1905/1; 1905/2"
 * - "1905/1 (resit); 1905/2"
 */
export function parseModuleTokenList(value: string): Array<{ moduleCode: string; isResit: boolean }> {
  const seen = new Map<string, boolean>();
  for (const raw of splitSemicolonTokens(value)) {
    const isResit = /\(\s*resit\s*\)/i.test(raw);
    const cleaned = raw.replace(/\(\s*resit\s*\)/gi, '').trim();
    if (!cleaned) continue;
    seen.set(cleaned, Boolean(seen.get(cleaned)) || isResit);
  }
  return Array.from(seen.entries()).map(([moduleCode, isResit]) => ({ moduleCode, isResit }));
}

/**
 * Parses "1905/1: 102; 1905/2: 201,202,203,204,205,206,207" into
 * `{ "1905/1": ["1905/102"], "1905/2": ["1905/201", ...] }`.
 */
export function parseBookedPapersByModule(value: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const block of splitSemicolonTokens(value)) {
    const colonIdx = block.indexOf(':');
    if (colonIdx === -1) continue;
    const moduleCode = block.slice(0, colonIdx).trim();
    const family = moduleCode.split('/')[0]?.trim() ?? '';
    const rawNumbers = block
      .slice(colonIdx + 1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!moduleCode || !rawNumbers.length) continue;
    const fullCodes = rawNumbers.map((num) => (num.includes('/') ? num : `${family}/${num}`));
    result[moduleCode] = Array.from(new Set([...(result[moduleCode] ?? []), ...fullCodes]));
  }
  return result;
}

export function parseHistoricalProgressSheetRow(cells: string[]): ParsedHistoricalKnecRow | null {
  const admissionNumber = (cells[2] ?? '').trim();
  if (!admissionNumber) return null;

  const requiredModules = parseModuleTokenList(cells[6] ?? '').map((item) => item.moduleCode);
  const pendingModules = parseModuleTokenList(cells[7] ?? '');
  const registeredNov2026Modules = parseModuleTokenList(cells[9] ?? '').map((item) => item.moduleCode);
  const notYetModules = parseModuleTokenList(cells[10] ?? '');
  const nov2026PapersByModule = parseBookedPapersByModule(cells[11] ?? '');

  return {
    admissionNumber,
    studentName: (cells[1] ?? '').trim(),
    programmeCode: (cells[3] ?? '').trim().toUpperCase(),
    cohortName: (cells[4] ?? '').trim(),
    deptStatus: (cells[5] ?? '').trim(),
    requiredModules,
    pendingModules,
    registeredNov2026Modules,
    notYetModules,
    nov2026PapersByModule,
    actionLabel: (cells[12] ?? '').trim(),
  };
}

export interface StoredModuleStatusInput {
  moduleId: string;
  status: KnecModuleStatus;
  completionSource: 'historical_import' | 'booking_results' | 'manual_override' | 'derived';
  completedSeriesName: string | null;
  resitPaperCodes: string[];
  notes: string | null;
}

export function deriveStudentKnecProgress(params: {
  modules: KnecModuleItem[];
  storedStatuses: StoredModuleStatusInput[];
  bookings: KnecBookingRecord[];
}): {
  items: StudentKnecModuleProgressItem[];
  requiredCount: number;
  completedCount: number;
  resitCount: number;
  bookedCount: number;
  pendingCount: number;
  completionPercent: number;
  overallStatus: KnecOverallCompletionStatus;
} {
  const storedByModule = new Map(params.storedStatuses.map((s) => [s.moduleId, s]));
  const activeBookings = params.bookings.filter((b) => b.bookingStatus !== 'cancelled');

  const items: StudentKnecModuleProgressItem[] = params.modules.map((mod) => {
    const stored = storedByModule.get(mod.id);
    const papersInMod = activeBookings.flatMap((booking) =>
      booking.papers
        .filter((p) => (p.moduleId === mod.id || p.moduleCode === mod.moduleCode) && p.paperStatus !== 'cancelled')
        .map((p) => ({ booking, paper: p })),
    );

    let status: KnecModuleStatus = stored?.status ?? 'pending';
    let completionSource = stored?.completionSource ?? 'derived';
    let completedSeriesName = stored?.completedSeriesName ?? null;
    let activeSeriesName: string | null = null;
    let resitPaperCodes = [...(stored?.resitPaperCodes ?? [])];

    // Live booking results or active bookings refine historical baseline cleanly
    if (papersInMod.length > 0) {
      const hasOpenBooking = papersInMod.some(
        ({ booking, paper }) =>
          booking.bookingStatus !== 'results_recorded' &&
          (paper.paperStatus === 'booked' || paper.paperStatus === 'sat'),
      );

      const latestByPaper = new Map<string, (typeof papersInMod)[number]>();
      for (const entry of papersInMod) {
        if (!latestByPaper.has(entry.paper.paperCode)) {
          latestByPaper.set(entry.paper.paperCode, entry);
        }
      }

      const referredPapers = Array.from(latestByPaper.values())
        .filter(({ paper }) => paper.paperStatus === 'referred' || paper.paperStatus === 'absent')
        .map(({ paper }) => paper.paperCode);

      const passedPapers = Array.from(latestByPaper.values())
        .filter(({ paper }) => paper.paperStatus === 'passed');

      const expectedPaperCodes = mod.papers.map((p) => p.paperCode);
      const passedSet = new Set(passedPapers.map((p) => p.paper.paperCode));
      const allExpectedPassed =
        expectedPaperCodes.length > 0 && expectedPaperCodes.every((code) => passedSet.has(code));

      if (stored?.completionSource === 'manual_override' && stored.status === 'completed') {
        status = 'completed';
      } else if (stored?.completionSource === 'manual_override' && stored.status === 'exempt') {
        status = 'exempt';
      } else if (allExpectedPassed && status !== 'completed') {
        status = 'completed';
        completionSource = 'booking_results';
        completedSeriesName = passedPapers[0]?.booking.seriesName ?? completedSeriesName;
        resitPaperCodes = [];
      } else if (hasOpenBooking) {
        const activeEntry = papersInMod.find(
          ({ booking, paper }) =>
            booking.bookingStatus !== 'results_recorded' &&
            (paper.paperStatus === 'booked' || paper.paperStatus === 'sat'),
        );
        status = 'booked';
        activeSeriesName = activeEntry?.booking.seriesName ?? null;
      } else if (referredPapers.length > 0 && status !== 'completed') {
        status = 'resit';
        completionSource = 'booking_results';
        resitPaperCodes = Array.from(new Set([...resitPaperCodes, ...referredPapers]));
      }
    }

    return {
      module: mod,
      status,
      completionSource,
      completedSeriesName,
      activeSeriesName,
      resitPaperCodes,
      notes: stored?.notes ?? null,
    };
  });

  const requiredItems = items.filter((i) => i.status !== 'exempt');
  const requiredCount = requiredItems.length;
  const completedCount = requiredItems.filter((i) => i.status === 'completed').length;
  const resitCount = requiredItems.filter((i) => i.status === 'resit').length;
  const bookedCount = requiredItems.filter((i) => i.status === 'booked').length;
  const pendingCount = requiredItems.filter((i) => i.status === 'pending').length;
  const completionPercent = requiredCount > 0 ? Math.round((completedCount / requiredCount) * 100) : 0;

  let overallStatus: KnecOverallCompletionStatus = 'not_started';
  if (requiredCount > 0 && completedCount === requiredCount) {
    overallStatus = 'completed';
  } else if (bookedCount > 0) {
    overallStatus = 'booked';
  } else if (resitCount > 0) {
    overallStatus = 'resit_pending';
  } else if (completedCount > 0) {
    overallStatus = 'in_progress';
  }

  return {
    items,
    requiredCount,
    completedCount,
    resitCount,
    bookedCount,
    pendingCount,
    completionPercent,
    overallStatus,
  };
}
