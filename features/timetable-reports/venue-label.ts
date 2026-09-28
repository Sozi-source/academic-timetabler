function normalizedVenuePart(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

export function formatVenueLabel(
  roomCode: string | null | undefined,
  roomName: string | null | undefined,
  fallback = 'No room assigned',
): string {
  const code = roomCode?.trim();
  const name = roomName?.trim();

  if (!code && !name) return fallback;
  if (!code) return name ?? fallback;
  if (!name) return code;
  if (normalizedVenuePart(code) === normalizedVenuePart(name)) return name;
  return `${code} · ${name}`;
}

