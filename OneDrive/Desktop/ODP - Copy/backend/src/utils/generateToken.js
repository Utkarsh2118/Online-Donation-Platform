const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Short-lived access token (default 15 min)
 */
const generateAccessToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is missing');
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
};

/**
 * Opaque refresh token — stored hashed in DB, sent in httpOnly cookie
 * Returns { raw, hashed, expiresAt }
 */
const generateRefreshToken = () => {
  const raw = crypto.randomBytes(40).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  const days = parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return { raw, hashed, expiresAt };
};

/**
 * Set refresh token as secure httpOnly cookie
 */
const setRefreshCookie = (res, rawToken, expiresAt) => {
  res.cookie('refreshToken', rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    expires: expiresAt,
    path: '/api/auth'   // only sent to auth endpoints
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', { httpOnly: true, path: '/api/auth' });
};

module.exports = { generateAccessToken, generateRefreshToken, setRefreshCookie, clearRefreshCookie };
