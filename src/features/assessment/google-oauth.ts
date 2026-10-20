import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

import { createAdminClient } from '@/lib/supabase/admin';

const googleScopes = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google sign-in is not configured. Set the Google OAuth client ID, client secret, and redirect URI.');
  }
  return { clientId, clientSecret, redirectUri };
}

export function createGoogleOAuthClient() {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

function getEncryptionKey(): Buffer {
  const value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error('Google token encryption is not configured. Set GOOGLE_TOKEN_ENCRYPTION_KEY.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

function encryptRefreshToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

function decryptRefreshToken(value: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('The saved Google authorization has an invalid format. Reconnect the Google account.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

interface GoogleIntegrationRow {
  department_id: string;
  google_email: string;
  refresh_token_ciphertext: string;
}

async function getGoogleIntegration(departmentId: string): Promise<GoogleIntegrationRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('department_google_integrations')
    .select('department_id, google_email, refresh_token_ciphertext')
    .eq('department_id', departmentId)
    .maybeSingle<GoogleIntegrationRow>();
  if (error) throw new Error(`Could not read the department Google connection: ${error.message}`);
  return data;
}

export async function getGoogleConnectionStatus(departmentId: string) {
  const integration = await getGoogleIntegration(departmentId);
  return integration ? { connected: true, email: integration.google_email } : { connected: false, email: null };
}

export async function saveGoogleAuthorization(input: {
  code: string;
  departmentId: string;
  profileId: string;
}): Promise<string> {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(input.code);
  client.setCredentials(tokens);

  const accessToken = tokens.access_token;
  if (!accessToken) throw new Error('Google did not return an access token. Please reconnect and approve access.');

  const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const userInfo = await userInfoResponse.json().catch(() => ({})) as {
    email?: string;
    email_verified?: boolean;
  };
  if (!userInfoResponse.ok || !userInfo.email || !userInfo.email_verified) {
    throw new Error('Google did not return a verified account email. Please reconnect and approve access.');
  }

  const existing = await getGoogleIntegration(input.departmentId);
  const refreshToken = tokens.refresh_token
    ? encryptRefreshToken(tokens.refresh_token)
    : existing?.refresh_token_ciphertext;
  if (!refreshToken) {
    throw new Error('Google did not issue a refresh token. Revoke this app in your Google Account permissions, then connect again.');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('department_google_integrations').upsert({
    department_id: input.departmentId,
    google_email: userInfo.email,
    refresh_token_ciphertext: refreshToken,
    connected_by: input.profileId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'department_id' });
  if (error) throw new Error(`Could not save the Google account connection: ${error.message}`);
  return userInfo.email;
}

export async function getGoogleAccessToken(departmentId: string): Promise<string> {
  const integration = await getGoogleIntegration(departmentId);
  if (!integration) throw new Error('Connect the college Google account before creating or syncing trainer sheets.');

  const client = createGoogleOAuthClient();
  client.setCredentials({ refresh_token: decryptRefreshToken(integration.refresh_token_ciphertext) });
  const response = await client.getAccessToken();
  if (!response.token) throw new Error('Google did not return an access token. Reconnect the college Google account.');
  return response.token;
}

export function buildGoogleAuthorizationUrl(state: string): string {
  return createGoogleOAuthClient().generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    prompt: 'consent select_account',
    scope: googleScopes,
    state,
  });
}
