export function nairobiToday(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function normalizeDailyReportDate(
  value: string | undefined,
): string {
  const today = nairobiToday();

  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return today;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return Number.isNaN(parsed.getTime()) ? today : value;
}

export function shiftDailyReportDate(value: string, days: number): string {
  const norm = normalizeDailyReportDate(value);
  const d = new Date(`${norm}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

export function formatDailyReportDate(value?: string | null): string {
  if (!value) return '';
  try {
    const d = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return String(value || '');
  }
}

export function formatDailyReportTime(value?: string | null): string {
  if (!value || typeof value !== 'string') return '--:--';
  try {
    const [rawHour, minute = '00'] = value.slice(0, 5).split(':');
    const hour = Number(rawHour);

    if (!Number.isFinite(hour)) return value.slice(0, 5);

    return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
  } catch {
    return String(value || '--:--');
  }
}

export function getAbsenteeColumnClass(count: number): string {
  if (count > 16) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4';
  if (count > 8) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  if (count > 3) return 'grid-cols-1 sm:grid-cols-2';
  return 'grid-cols-1';
}

export function formatAbsenteeLine(student: {
  fullName: string;
  admissionNumber: string;
  note?: string | null;
}): string {
  const noteSuffix = student.note ? ` [${student.note}]` : '';
  return `${student.fullName} (${student.admissionNumber})${noteSuffix}`;
}
