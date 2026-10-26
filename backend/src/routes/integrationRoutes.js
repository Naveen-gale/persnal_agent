import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { SyncJob } from '../models/SyncJob.js';
import { getAuthorizationUrl, exchangeCodeForTokens } from '../services/googleOAuth.js';
import { encryptTokens, decryptTokens } from '../services/tokenEncryption.js';

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

    // ─── Fire-and-forget durable background sync ───
    // Create a persistent SyncJob so progress survives browser close.
    // Then launch sequential chunked sync that never crashes free-tier Render.
    if (tokens.access_token) {
      setImmediate(async () => {
        try {
          // Create SyncJob document
          const { SyncJob: SJ } = await import('../models/SyncJob.js');
          const syncJob = new SJ({
            userId: user._id,
            userEmail: googleEmail || user.email,
            status: 'pending',
            message: 'Preparing background sync…',
          });
          await syncJob.save();

          // Run data sync (Contacts → Gmail → Drive) SEQUENTIALLY with batch delays
          const { syncAllGoogleDataToMongoDB } = await import('../services/googleDataSync.js');
          await syncAllGoogleDataToMongoDB(user, tokens.access_token, googleEmail, syncJob);

          // Run photo sync AFTER data sync (heaviest I/O — downloads + uploads)
          try {
            syncJob.photos.status = 'syncing';
            syncJob.message = 'Syncing Google Photos to ImageKit CDN…';
            await syncJob.save();

            const { syncGooglePhotosToImageKit } = await import('../services/imagekitSync.js');
            const photoResult = await syncGooglePhotosToImageKit(user, tokens.access_token, 500);

            syncJob.photos.status = 'done';
            syncJob.photos.synced = photoResult?.synced || 0;
            syncJob.photos.total = photoResult?.total || 0;
          } catch (photoErr) {
            console.error(`[Photo Sync Warning]`, photoErr.message);
            syncJob.photos.status = 'error';
            syncJob.photos.error = photoErr.message;
          }

          // Final save
          if (syncJob.status !== 'error') {
            syncJob.status = syncJob.photos.status === 'error' ? 'partial' : (syncJob.status === 'partial' ? 'partial' : 'completed');
          }
          syncJob.completedAt = new Date();
          syncJob.message = `Sync finished. Contacts: ${syncJob.contacts.synced}, Emails: ${syncJob.gmail.synced}, Drive: ${syncJob.drive.synced}, Photos: ${syncJob.photos.synced}`;
          await syncJob.save();

          console.log(`[Background Sync] ✔ All done for ${user.email}`);
        } catch (bgErr) {
          console.error(`[Background Sync Fatal]`, bgErr.message);
        }
      });
    }

    return res.redirect(`${config.frontendUrl}/?google_connected=true`);
  } catch (error) {
    console.error('[Google OAuth Error]', error);
    return res.redirect(
      `${config.frontendUrl}/?google_error=${encodeURIComponent(`Google authorization failed: ${error.message}`)}`
    );
  }
});

/**
 * GET /api/v1/integrations/google/sync-status
 * Return the latest background SyncJob progress for the authenticated user.
 * Frontend can poll this to show real-time sync status.
 */
router.get('/google/sync-status', requireAuth, async (req, res, next) => {
  try {
    const job = await SyncJob.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!job) {
      return res.json({ syncJob: null, message: 'No sync has been started yet.' });
    }

    return res.json({ syncJob: job });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/integrations/google/resync
 * Manually trigger a fresh background sync for the authenticated user.
 */
router.post('/google/resync', requireAuth, async (req, res, next) => {
  try {
    if (!req.user.googleIntegration || !req.user.googleIntegration.connected) {
      return res.status(400).json({ error: 'Google account is not connected.' });
    }

    const tokens = decryptTokens(req.user.googleIntegration, config.tokenEncryptionKey);
    const accessToken = tokens?.access_token || tokens?.token;
    if (!accessToken) {
      return res.status(400).json({ error: 'No active Google OAuth token. Please re-authorize.' });
    }

    // Check if a sync is already running
    const existing = await SyncJob.findOne({ userId: req.user._id, status: 'syncing' });
    if (existing) {
      return res.json({ message: 'A sync is already in progress.', syncJob: existing });
    }

    const googleEmail = req.user.googleIntegration.email || req.user.email;

    // Create new SyncJob and launch in background
    const syncJob = new SyncJob({
      userId: req.user._id,
      userEmail: googleEmail,
      status: 'pending',
      message: 'Manual resync queued…',
    });
    await syncJob.save();

    setImmediate(async () => {
      try {
        const { syncAllGoogleDataToMongoDB } = await import('../services/googleDataSync.js');
        await syncAllGoogleDataToMongoDB(req.user, accessToken, googleEmail, syncJob);

        try {
          syncJob.photos.status = 'syncing';
          syncJob.message = 'Syncing Google Photos to ImageKit CDN…';
          await syncJob.save();

          const { syncGooglePhotosToImageKit } = await import('../services/imagekitSync.js');
          const photoResult = await syncGooglePhotosToImageKit(req.user, accessToken, 500);
          syncJob.photos.status = 'done';
          syncJob.photos.synced = photoResult?.synced || 0;
          syncJob.photos.total = photoResult?.total || 0;
        } catch (photoErr) {
          syncJob.photos.status = 'error';
          syncJob.photos.error = photoErr.message;
        }

        syncJob.status = syncJob.photos.status === 'error' ? 'partial' : (syncJob.status === 'partial' ? 'partial' : 'completed');
        syncJob.completedAt = new Date();
        syncJob.message = `Resync finished. Contacts: ${syncJob.contacts.synced}, Emails: ${syncJob.gmail.synced}, Drive: ${syncJob.drive.synced}, Photos: ${syncJob.photos.synced}`;
        await syncJob.save();
      } catch (err) {
        console.error(`[Manual Resync Error]`, err.message);
      }
    });

    return res.status(202).json({
      message: 'Background resync started.',
      syncJob,
    });
  } catch (error) {
    next(error);
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
