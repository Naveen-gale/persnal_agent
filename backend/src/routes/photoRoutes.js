import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Photo } from '../models/Photo.js';
import { decryptTokens } from '../services/tokenEncryption.js';
import { config } from '../config/env.js';
import {
  syncGooglePhotosToImageKit,
  getSyncProgress,
  updateSyncProgress,
  createPhotosPickerSession,
  syncPickerSessionToImageKit,
  uploadToImageKit,
} from '../services/imagekitSync.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/v1/photos
 * List all synced Google Photos stored on ImageKit for this user.
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const skip = (page - 1) * limit;

    const [photos, total] = await Promise.all([
      Photo.find({ userId: req.user._id })
        .sort({ creationTime: -1, syncedAt: -1 })
        .skip(skip)
        .limit(limit),
      Photo.countDocuments({ userId: req.user._id }),
    ]);

    return res.json({
      photos,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/photos/sync-progress
 * Poll the live progress of photo synchronization to ImageKit.
 */
router.get('/sync-progress', async (req, res) => {
  const progress = getSyncProgress(req.user._id);
  return res.json({
    progress,
  });
});

/**
 * POST /api/v1/photos/sync
 * Trigger asynchronous photo synchronization to ImageKit.
 * Runs in the background to prevent timeouts on free deployments (Render/Vercel/Railway).
 */
router.post('/sync', async (req, res, next) => {
  try {
    if (!req.user.googleIntegration || !req.user.googleIntegration.connected) {
      return res.status(400).json({
        error: 'Google account is not connected. Please connect your Google account first.',
      });
    }

    const tokens = decryptTokens(req.user.googleIntegration, config.tokenEncryptionKey);
    const accessToken = tokens?.access_token || tokens?.token;

    if (!accessToken) {
      return res.status(400).json({
        error: 'No active Google OAuth token found. Please re-authorize Google.',
      });
    }

    const currentProgress = getSyncProgress(req.user._id);
    if (currentProgress && currentProgress.status === 'syncing') {
      return res.status(200).json({
        message: 'Photo synchronization is already in progress.',
        status: 'syncing',
        progress: currentProgress,
      });
    }

    const pageSize = parseInt(req.body.pageSize || '30', 10);

    // Initial state
    updateSyncProgress(req.user._id, {
      status: 'syncing',
      phase: 'Starting sync...',
      current: 0,
      total: 0,
      percent: 5,
      message: 'Connecting to Google and ImageKit...',
      requiresReauth: false,
    });

    // Execute in background so free tier hosting doesn't time out the HTTP connection
    setImmediate(async () => {
      try {
        await syncGooglePhotosToImageKit(req.user, accessToken, pageSize);
      } catch (err) {
        console.error(`[Background Photo Sync Error]:`, err.message);
      }
    });

    return res.status(202).json({
      message: 'Google Photos synchronization started in the background.',
      status: 'syncing',
      progress: getSyncProgress(req.user._id),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/photos/picker/session
 * Initiate a Google Photos Picker session.
 */
router.post('/picker/session', async (req, res, next) => {
  try {
    if (!req.user.googleIntegration || !req.user.googleIntegration.connected) {
      return res.status(400).json({
        error: 'Google account is not connected. Please connect your Google account first.',
      });
    }

    const tokens = decryptTokens(req.user.googleIntegration, config.tokenEncryptionKey);
    const accessToken = tokens?.access_token || tokens?.token;

    if (!accessToken) {
      return res.status(400).json({
        error: 'No active Google OAuth token found. Please re-authorize Google.',
      });
    }

    const sessionData = await createPhotosPickerSession(accessToken);
    return res.json({
      success: true,
      ...sessionData,
    });
  } catch (error) {
    const status = error.response?.status;
    const msg = error.response?.data?.error?.message || error.message;
    if (status === 403) {
      return res.status(403).json({
        error: 'Google Photos Picker permission not yet granted. Please click "Re-authorize Google" to grant access.',
        requiresReauth: true,
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/photos/picker/complete
 * Sync selected photos from a Google Photos Picker session to ImageKit.
 */
router.post('/picker/complete', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const tokens = decryptTokens(req.user.googleIntegration, config.tokenEncryptionKey);
    const accessToken = tokens?.access_token || tokens?.token;

    if (!accessToken) {
      return res.status(400).json({ error: 'Google OAuth token missing. Please re-authorize Google.' });
    }

    updateSyncProgress(req.user._id, {
      status: 'syncing',
      phase: 'Fetching selected photos from Google...',
      current: 0,
      total: 0,
      percent: 10,
      message: 'Processing selected photos from Google Photos Picker...',
    });

    // Run in background for free tier timeout safety
    setImmediate(async () => {
      try {
        await syncPickerSessionToImageKit(req.user, accessToken, sessionId);
      } catch (err) {
        console.error(`[Background Picker Sync Error]:`, err.message);
      }
    });

    return res.status(202).json({
      message: 'Picker photo synchronization started in background.',
      status: 'syncing',
      progress: getSyncProgress(req.user._id),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/photos/upload-direct
 * Directly upload an image to ImageKit and save to user's gallery.
 */
router.post('/upload-direct', async (req, res, next) => {
  try {
    const { fileBase64, fileName, mimeType } = req.body;
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'fileBase64 and fileName are required.' });
    }

    const cleanBase64 = fileBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > 20 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 20MB limit.' });
    }

    const uploadRes = await uploadToImageKit({
      file: buffer,
      fileName,
      userId: req.user._id.toString(),
      tags: ['direct-upload'],
    });

    const photoDoc = new Photo({
      userId: req.user._id,
      googlePhotoId: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      filename: fileName,
      mimeType: mimeType || 'image/jpeg',
      imageKitFileId: uploadRes.fileId,
      imageKitUrl: uploadRes.url,
      thumbnailUrl: uploadRes.thumbnailUrl || uploadRes.url,
      width: uploadRes.width || null,
      height: uploadRes.height || null,
      creationTime: new Date(),
      syncedAt: new Date(),
    });

    await photoDoc.save();

    return res.status(201).json({
      message: 'Photo uploaded and stored in ImageKit successfully.',
      photo: photoDoc,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
