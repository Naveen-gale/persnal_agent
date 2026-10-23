import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { getAuthorizationUrl, exchangeCodeForTokens } from '../services/googleOAuth.js';
import { encryptTokens } from '../services/tokenEncryption.js';

const router = express.Router();

/**
 * GET /api/v1/integrations/google/status
 * Get the Google integration status for the authenticated user.
 */
router.get('/google/status', requireAuth, (req, res) => {
  const integration = req.user.googleIntegration || {};
  const isConnected = Boolean(integration.connected);
  const data = {
    connected: isConnected,
    email: integration.email || '',
    scopes: integration.scopes || [],
    connectedAt: integration.connectedAt || null,
  };
  return res.json({
    ...data,
    integration: data,
  });
});

/**
 * GET /api/v1/integrations/google/connect
 * Initiate Google OAuth authorization flow. Returns consent URL.
 */
router.get('/google/connect', requireAuth, (req, res, next) => {
  try {
    if (!config.googleClientId || !config.googleClientSecret) {
      return res.status(400).json({
        error: 'Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured on the server.',
      });
    }

    // Embed authenticated user ID into a short-lived signed state token for CSRF protection
    const stateToken = jwt.sign(
      { userId: req.user._id.toString(), nonce: Math.random().toString(36).slice(2) },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    const authUrl = getAuthorizationUrl(stateToken);

    if (req.query.redirect === 'true') {
      return res.redirect(authUrl);
    }

    return res.json({ authUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/integrations/google/callback
 * Google OAuth redirect endpoint. Handles code exchange, encrypts tokens, and associates with user.
 */
router.get('/google/callback', async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`${config.frontendUrl}/?google_error=${encodeURIComponent('Google authorization was cancelled or failed.')}`);
    }

    if (!code || !state) {
      return res.redirect(`${config.frontendUrl}/?google_error=${encodeURIComponent('Missing authorization code or state token.')}`);
    }

    // Validate CSRF state token
    let decodedState;
    try {
      decodedState = jwt.verify(state, config.jwtSecret);
    } catch {
      return res.redirect(`${config.frontendUrl}/?google_error=${encodeURIComponent('Invalid or expired OAuth state token. Please try again.')}`);
    }

    const user = await User.findById(decodedState.userId);
    if (!user) {
      return res.redirect(`${config.frontendUrl}/?google_error=${encodeURIComponent('User account not found.')}`);
    }

    // Exchange authorization code for tokens
    const { tokens, email: googleEmail } = await exchangeCodeForTokens(code);

    // Encrypt the tokens with AES-256-GCM before saving to MongoDB
    const { encryptedData, iv, authTag } = encryptTokens(tokens, config.tokenEncryptionKey);

    const grantedScopes = typeof tokens.scope === 'string' ? tokens.scope.split(' ') : [];

    user.googleIntegration = {
      connected: true,
      encryptedData,
      iv,
      authTag,
      scopes: grantedScopes,
      email: googleEmail || '',
      connectedAt: new Date(),
    };

    await user.save();

    console.log(`[Google OAuth] Successfully connected Google account for user: ${user.email} (Google: ${googleEmail})`);

    return res.redirect(`${config.frontendUrl}/?google_connected=true`);
  } catch (error) {
    console.error('[Google OAuth Error]', error);
    return res.redirect(
      `${config.frontendUrl}/?google_error=${encodeURIComponent(`Google authorization failed: ${error.message}`)}`
    );
  }
});

/**
 * POST /api/v1/integrations/google/disconnect
 * Disconnect Google integration and clear stored credentials.
 */
router.post('/google/disconnect', requireAuth, async (req, res, next) => {
  try {
    req.user.googleIntegration = {
      connected: false,
      encryptedData: '',
      iv: '',
      authTag: '',
      scopes: [],
      email: '',
      connectedAt: null,
    };

    await req.user.save();

    return res.json({
      message: 'Google account disconnected successfully.',
      status: {
        connected: false,
        email: '',
        scopes: [],
        connectedAt: null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
