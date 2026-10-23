import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';

/**
 * Middleware to require authentication via HttpOnly cookie or Bearer token.
 */
export async function requireAuth(req, res, next) {
  try {
    let token = null;

    // Check HttpOnly cookie first
    if (req.cookies && req.cookies[config.cookieName]) {
      token = req.cookies[config.cookieName];
    }
    // Fall back to Authorization Bearer header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please log in.',
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'User account no longer exists or session has expired.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication session.' });
  }
}

/**
 * Generate a signed JWT session token for a user.
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    {
      expiresIn: Math.floor(config.sessionMaxAgeMs / 1000), // seconds
    }
  );
}

/**
 * Set the secure authentication cookie on response.
 */
export function setAuthCookie(res, token) {
  const isProduction = config.env === 'production';
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: isProduction, // HTTPS required in production
    sameSite: isProduction ? 'none' : 'lax', // 'none' needed for cross-origin Vercel <-> Render
    maxAge: config.sessionMaxAgeMs,
    path: '/',
  });
}

/**
 * Clear the authentication cookie on logout.
 */
export function clearAuthCookie(res) {
  const isProduction = config.env === 'production';
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
}
