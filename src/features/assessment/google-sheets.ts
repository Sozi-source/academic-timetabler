import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';

async function accessToken(): Promise<string> {
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
  const serviceAccount = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  if (!projectNumber || !poolId || !providerId || !serviceAccount) {
    throw new Error('Google Sheets integration is not configured. Set the Vercel OIDC federation environment variables.');
  }

  const audience = process.env.GCP_AUDIENCE ??
    `https://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience }),
    },
  });
  if (!authClient) throw new Error('Could not initialize Google workload identity federation.');
  const accessTokenResponse = await authClient.getAccessToken();
  if (!accessTokenResponse.token) throw new Error('Google workload identity federation did not return an access token.');
  return accessTokenResponse.token;
}

async function googleRequest<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? 'Google Sheets request failed.');
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
}): Promise<string> {
  const token = await accessToken();
  const spreadsheet = await googleRequest<{ spreadsheetId: string }>(
    'https://sheets.googleapis.com/v4/spreadsheets',
    token,
    { method: 'POST', body: JSON.stringify({ properties: { title: input.title }, sheets: [{ properties: { title: 'Marks' } }] }) },
  );

  await googleRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/Marks%21A1%3AG${input.rows.length}?valueInputOption=RAW`,
    token,
    { method: 'PUT', body: JSON.stringify({ values: input.rows }) },
  );

  const email = input.trainerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid trainer email address.');
  await googleRequest(
    `https://www.googleapis.com/drive/v3/files/${spreadsheet.spreadsheetId}/permissions?sendNotificationEmail=true`,
    token,
    { method: 'POST', body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }) },
  );
  return `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`;
}

export async function readTrainerSpreadsheet(url: string): Promise<string[][]> {
  const spreadsheetId = getSpreadsheetId(url);
  const token = await accessToken();
  const result = await googleRequest<{ values?: unknown[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Marks%21A%3AG`,
    token,
  );
  return (result.values ?? []).map((row) => row.map((cell) => String(cell ?? '')));
}

export function rowsToCsv(rows: string[][]): Buffer {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return Buffer.from(csv, 'utf8');
}
