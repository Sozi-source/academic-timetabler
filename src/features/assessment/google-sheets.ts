import { getGoogleAccessToken } from '@/features/assessment/google-oauth';

async function googleRequest<T>(url: string, token: string, operation: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) {
    const details = payload.error?.message ?? 'Unknown Google API error.';
    throw new Error(`${operation} failed (Google HTTP ${response.status}): ${details}`);
  }
  return payload;
}

export function getSpreadsheetId(value: string): string {
  const match = value.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('Enter a valid Google Sheets URL.');
  return match[1];
}

export async function createTrainerSpreadsheet(input: {
  title: string;
  trainerEmail: string;
  rows: Array<Array<string | number>>;
  departmentId: string;
}): Promise<string> {
  const token = await getGoogleAccessToken(input.departmentId);
  const spreadsheet = await googleRequest<{ spreadsheetId: string }>(
    'https://sheets.googleapis.com/v4/spreadsheets',
    token,
    'Creating the spreadsheet in the connected college Google Drive',
    { method: 'POST', body: JSON.stringify({ properties: { title: input.title }, sheets: [{ properties: { title: 'Marks' } }] }) },
  );

  await googleRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/Marks%21A1%3AG${input.rows.length}?valueInputOption=RAW`,
    token,
    'Filling the spreadsheet roster',
    { method: 'PUT', body: JSON.stringify({ values: input.rows }) },
  );

  const email = input.trainerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid trainer email address.');
  await googleRequest(
    `https://www.googleapis.com/drive/v3/files/${spreadsheet.spreadsheetId}/permissions?sendNotificationEmail=true`,
    token,
    'Sharing the spreadsheet with the trainer',
    { method: 'POST', body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }) },
  );
  return `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`;
}

export async function readTrainerSpreadsheet(url: string, departmentId: string): Promise<string[][]> {
  const spreadsheetId = getSpreadsheetId(url);
  const token = await getGoogleAccessToken(departmentId);
  const result = await googleRequest<{ values?: unknown[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Marks%21A%3AG`,
    token,
    'Reading marks from the spreadsheet',
  );
  return (result.values ?? []).map((row) => row.map((cell) => String(cell ?? '')));
}

export function rowsToCsv(rows: string[][]): Buffer {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return Buffer.from(csv, 'utf8');
}
