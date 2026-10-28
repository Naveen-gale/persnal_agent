import express from 'express';
import { User } from '../models/User.js';
import { isDbConnected, connectDB } from '../config/db.js';
import {
  clearAuthCookie,
  generateToken,
  requireAuth,
  setAuthCookie,
} from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Helper to ensure database is online before running user operations.
 */
async function ensureDbConnection() {
  if (!isDbConnected()) {
    try {
      await connectDB();
    } catch {
      // Handled by connection check below
    }
  }
  return isDbConnected();
}

/**
 * POST /api/v1/auth/register
 * Register a new user account.
 */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const dbOk = await ensureDbConnection();
    if (!dbOk) {
      return res.status(503).json({
        error: 'Database connection is currently offline. Please ensure MongoDB Atlas has IP 0.0.0.0/0 allowed in Network Access.',
      });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      // Return generic message to prevent account enumeration
      return res.status(400).json({ error: 'An account with this email already exists or is unavailable.' });
    }

    // Check if this is the first user in the database; if so, make them admin
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    const user = new User({
      email: normalizedEmail,
      name: name.trim(),
      role,
    });
    await user.setPassword(password);
    await user.save();

    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: user.toProfileJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * Log in to the application.
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const dbOk = await ensureDbConnection();
    if (!dbOk) {
      return res.status(503).json({
        error: 'Database connection is currently offline. Please ensure MongoDB Atlas has IP 0.0.0.0/0 allowed in Network Access.',
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Generic error message that doesn't reveal whether the email exists
    const invalidError = { error: 'Invalid email or password.' };

    if (!user) {
      return res.status(401).json(invalidError);
    }

    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return res.status(401).json(invalidError);
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.json({
      message: 'Logged in successfully.',
      user: user.toProfileJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Log out and clear session cookie.
 */
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ message: 'Logged out successfully.' });
});

/**
 * GET /api/v1/auth/me
 * Return the currently authenticated user's profile.
 */
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    user: req.user.toProfileJSON(),
  });
});

export default router;
