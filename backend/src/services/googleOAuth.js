import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env.js';

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
];

/**
 * Create a new OAuth2 client using server environment configuration.
 */
export function createOAuthClient() {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error('Google OAuth client ID or client secret is not configured.');
  }

  return new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );
}

/**
 * Generate Google consent authorization URL with secure state.
 * @param {string} state - CSRF state token
 * @returns {string} Google authorization URL
 */
export function getAuthorizationUrl(state) {
  const oauthClient = createOAuthClient();
  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

/**
 * Exchange OAuth callback code for access and refresh tokens.
 * @param {string} code - Authorization code from Google redirect
 * @returns {Promise<{ tokens: object, email: string }>}
 */
export async function exchangeCodeForTokens(code) {
  const oauthClient = createOAuthClient();
  const { tokens } = await oauthClient.getToken(code);

  let email = '';
  if (tokens.id_token) {
    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.googleClientId,
      });
      const payload = ticket.getPayload();
      email = payload?.email || '';
    } catch {
      // If id_token verification fails, fallback to userinfo
    }
  }

  // Fallback: fetch profile info from Google API
  if (!email && tokens.access_token) {
    try {
      oauthClient.setCredentials(tokens);
      const res = await oauthClient.request({
        url: 'https://www.googleapis.com/oauth2/v3/userinfo',
      });
      email = res.data?.email || '';
    } catch {
      // ignore
    }
  }

  return { tokens, email };
}
