export function isProtectedTimetableExchangeError(
  message: string,
) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('confirm that the active timetable') ||
    normalized.includes('return the active timetable to an editable draft')
  );
}
