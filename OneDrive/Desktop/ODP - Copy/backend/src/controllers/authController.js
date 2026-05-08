const crypto = require('crypto');
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  setRefreshCookie,
  clearRefreshCookie
} = require('../utils/generateToken');
const { sendEmail, emailVerificationTemplate, passwordResetTemplate } = require('../utils/sendEmail');
const AppError = require('../utils/AppError');

// ── Helpers ──────────────────────────────────────────────────────────────
const buildUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isBlocked: user.isBlocked,
  isEmailVerified: user.isEmailVerified,
  mobileNumber: user.mobileNumber || '',
  profilePicture: user.profilePicture || ''
});

const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

// ── Register ─────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    // req.body already validated & coerced by Zod middleware
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User already exists with this email', 409));
    }

    // Generate email verification token
    const rawVerifyToken = crypto.randomBytes(32).toString('hex');
    const hashedVerifyToken = hashToken(rawVerifyToken);

    const user = await User.create({
      name,
      email,
      password,
      emailVerificationToken: hashedVerifyToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 h
    });

    // Send verification email (non-blocking — don't fail registration if email fails)
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${rawVerifyToken}&email=${encodeURIComponent(email)}`;

    sendEmail({
      to: email,
      subject: 'Verify your email — OpenDonate',
      html: emailVerificationTemplate(name, verifyUrl)
    }).catch(err => console.error('[sendEmail] verification email failed:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: { user: buildUserPayload(user) }
    });
  } catch (error) {
    return next(error);
  }
};

// ── Verify email ─────────────────────────────────────────────────────────
const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.body;
    if (!token || !email) {
      return next(new AppError('Token and email are required', 400));
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const hashed = hashToken(token);

    const user = await User.findOne({
      email: normalizedEmail,
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: Date.now() }
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return next(new AppError('Invalid or expired verification link. Please request a new one.', 400));
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    return next(error);
  }
};

// ── Resend verification email ─────────────────────────────────────────────
const resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new AppError('Email is required', 400));

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+emailVerificationToken +emailVerificationExpires');

    // Always respond the same (don't reveal if email exists)
    if (!user || user.isEmailVerified) {
      return res.status(200).json({ success: true, message: 'If this email exists and is unverified, a new link has been sent.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = hashToken(rawToken);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    sendEmail({
      to: normalizedEmail,
      subject: 'Verify your email — OpenDonate',
      html: emailVerificationTemplate(user.name, verifyUrl)
    }).catch(err => console.error('[sendEmail] resend verification failed:', err.message));

    return res.status(200).json({ success: true, message: 'If this email exists and is unverified, a new link has been sent.' });
  } catch (error) {
    return next(error);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +refreshTokens');
    if (!user || !(await user.comparePassword(String(password)))) {
      return next(new AppError('Invalid email or password', 401));
    }

    if (user.isBlocked) {
      return next(new AppError('Your account is blocked. Please contact support.', 403));
    }

    // Issue tokens
    const accessToken = generateAccessToken({ id: user._id, role: user.role });
    const { raw, hashed, expiresAt } = generateRefreshToken();

    // Store hashed refresh token; prune expired ones first
    user.pruneExpiredTokens();
    user.refreshTokens.push({ token: hashed, expiresAt });
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, raw, expiresAt);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { accessToken, user: buildUserPayload(user) }
    });
  } catch (error) {
    return next(error);
  }
};

// ── Refresh access token ─────────────────────────────────────────────────
const refreshToken = async (req, res, next) => {
  try {
    const raw = req.cookies?.refreshToken;
    if (!raw) return next(new AppError('No refresh token provided', 401));

    const hashed = hashToken(raw);
    const now = new Date();

    const user = await User.findOne({
      'refreshTokens.token': hashed,
      'refreshTokens.expiresAt': { $gt: now }
    }).select('+refreshTokens');

    if (!user) {
      clearRefreshCookie(res);
      return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
    }

    if (user.isBlocked) {
      clearRefreshCookie(res);
      return next(new AppError('Your account is blocked.', 403));
    }

    // Rotate: remove old token, issue new one
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== hashed);
    const { raw: newRaw, hashed: newHashed, expiresAt } = generateRefreshToken();
    user.pruneExpiredTokens();
    user.refreshTokens.push({ token: newHashed, expiresAt });
    await user.save({ validateBeforeSave: false });

    const accessToken = generateAccessToken({ id: user._id, role: user.role });
    setRefreshCookie(res, newRaw, expiresAt);

    return res.status(200).json({ success: true, data: { accessToken } });
  } catch (error) {
    return next(error);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const raw = req.cookies?.refreshToken;

    if (raw) {
      const hashed = hashToken(raw);
      // Remove just this device's token
      await User.findByIdAndUpdate(req.user?.id, {
        $pull: { refreshTokens: { token: hashed } }
      });
    }

    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
};

// ── Forgot password ───────────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await user.save({ validateBeforeSave: false });

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    try {
      await sendEmail({ to: normalizedEmail, subject: 'Reset Your Password — OpenDonate', html: passwordResetTemplate(user.name, resetUrl) });
    } catch {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save({ validateBeforeSave: false });
      return next(new AppError('Failed to send reset email. Please try again.', 500));
    }

    return res.status(200).json({ success: true, message: 'If this email exists, a reset link has been sent.' });
  } catch (error) {
    return next(error);
  }
};

// ── Reset password ────────────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { token, email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const hashed = hashToken(token);

    const user = await User.findOne({
      email: normalizedEmail,
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+refreshTokens');

    if (!user) {
      return next(new AppError('Invalid or expired reset link. Please request a new one.', 400));
    }

    user.password = String(password);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    // Invalidate ALL refresh tokens on password change (security)
    user.refreshTokens = [];
    await user.save();

    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    return next(error);
  }
};

// ── Profile ───────────────────────────────────────────────────────────────
const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError('User not found', 404));
    return res.status(200).json({ success: true, data: { user: buildUserPayload(user) } });
  } catch (error) {
    return next(error);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    // req.body coerced by Zod — only valid keys present
    const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true, runValidators: true });
    if (!user) return next(new AppError('User not found', 404));
    return res.status(200).json({ success: true, message: 'Profile updated successfully', data: { user: buildUserPayload(user) } });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register, verifyEmail, resendVerificationEmail,
  login, refreshToken, logout,
  forgotPassword, resetPassword,
  getMyProfile, updateMyProfile
};
