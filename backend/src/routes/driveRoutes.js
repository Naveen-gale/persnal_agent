import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { DriveFile } from '../models/DriveFile.js';
import { decryptTokens } from '../services/tokenEncryption.js';
import { config } from '../config/env.js';
import { syncDriveFilesToMongoDB } from '../services/googleDataSync.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/v1/drive
 * Retrieve all Drive files saved in MongoDB for the authenticated user.
 * Supports pagination and optional search filter.
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search || req.query.q || '').trim();

    const query = { userId: req.user._id };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { name: searchRegex },
        { mimeType: searchRegex },
      ];
    }

    const [files, total] = await Promise.all([
      DriveFile.find(query)
        .sort({ createdTime: -1, syncedAt: -1 })
        .skip(skip)
        .limit(limit),
      DriveFile.countDocuments(query),
    ]);

    return res.json({
      files,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/drive/sync
 * Manually trigger synchronization of Drive files into MongoDB.
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
        error: 'No active Google OAuth token found. Please re-authorize Google in the dashboard.',
      });
    }

    const maxFiles = Math.min(parseInt(req.body.maxFiles || '100', 10), 200);
    const effectiveEmail = req.user.googleIntegration.email || req.user.email;
    const result = await syncDriveFilesToMongoDB(req.user, accessToken, effectiveEmail, maxFiles);

    return res.json({
      message: `Successfully synchronized ${result.syncedCount} Drive files to MongoDB.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
