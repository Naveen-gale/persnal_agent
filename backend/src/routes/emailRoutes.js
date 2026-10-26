import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Email } from '../models/Email.js';
import { decryptTokens } from '../services/tokenEncryption.js';
import { config } from '../config/env.js';
import { syncGmailToMongoDB } from '../services/googleDataSync.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/v1/emails
 * Retrieve all emails saved in MongoDB for the authenticated user.
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
        { subject: searchRegex },
        { snippet: searchRegex },
        { from: searchRegex },
        { to: searchRegex },
      ];
    }

    const [emails, total] = await Promise.all([
      Email.find(query)
        .sort({ syncedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Email.countDocuments(query),
    ]);

    return res.json({
      emails,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/emails/sync
 * Manually trigger synchronization of recent Gmail messages into MongoDB.
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

    const maxMessages = Math.min(parseInt(req.body.maxMessages || '100', 10), 200);
    const effectiveEmail = req.user.googleIntegration.email || req.user.email;
    const result = await syncGmailToMongoDB(req.user, accessToken, effectiveEmail, maxMessages);

    return res.json({
      message: `Successfully synchronized ${result.syncedCount} emails to MongoDB.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
