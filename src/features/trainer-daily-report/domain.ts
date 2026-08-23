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

export function formatDailyReportDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatDailyReportTime(value: string): string {
  const [rawHour, minute = '00'] = value.slice(0, 5).split(':');
  const hour = Number(rawHour);

  if (!Number.isFinite(hour)) return value.slice(0, 5);

  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}
