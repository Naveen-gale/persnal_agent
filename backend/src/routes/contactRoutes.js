import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Contact } from '../models/Contact.js';
import { decryptTokens } from '../services/tokenEncryption.js';
import { config } from '../config/env.js';
import { syncGoogleContactsToMongoDB } from '../services/googleDataSync.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/v1/contacts
 * Retrieve all contacts saved in MongoDB for the authenticated user.
 * Supports pagination and optional search filter.
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);
    const skip = (page - 1) * limit;
    const search = (req.query.search || req.query.q || '').trim();

    const query = { userId: req.user._id };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
      Contact.countDocuments(query),
    ]);

    return res.json({
      contacts,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/contacts/sync
 * Manually trigger synchronization of contacts from Google People API into MongoDB.
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

    const effectiveEmail = req.user.googleIntegration.email || req.user.email;
    const result = await syncGoogleContactsToMongoDB(req.user, accessToken, effectiveEmail);

    return res.json({
      message: `Successfully synchronized ${result.syncedCount} contacts to MongoDB.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
