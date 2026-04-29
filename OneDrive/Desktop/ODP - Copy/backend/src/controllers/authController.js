const crypto = require('crypto');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const AppError = require('../utils/AppError');

const buildUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isBlocked: user.isBlocked,
  mobileNumber: user.mobileNumber || '',
  profilePicture: user.profilePicture || ''
});

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return next(new AppError('Name, email, and password are required', 400));
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return next(new AppError('User already exists with this email', 409));
    }
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password)
    });
    const token = generateToken({ id: user._id, role: user.role });
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { token, user: buildUserPayload(user) }
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Email and password are required', 400));
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }
    const isPasswordValid = await user.comparePassword(String(password));
    if (!isPasswordValid) {
      return next(new AppError('Invalid email or password', 401));
    }
    if (user.isBlocked) {
      return next(new AppError('Your account is blocked. Please contact support.', 403));
    }
    const token = generateToken({ id: user._id, role: user.role });
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token, user: buildUserPayload(user) }
    });
  } catch (error) {
    return next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Always return success (security - don't reveal if email exists)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If this email exists, a reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await user.save({ validateBeforeSave: false });

    // Send email via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://online-donation-platform-chi.vercel.app';
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    const emailBody = {
      from: process.env.FROM_EMAIL || 'OpenDonate <noreply@yourdomain.com>',
      to: [normalizedEmail],
      subject: 'Reset Your Password - OpenDonate',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
          <h2 style="color:#0f766e;margin-bottom:8px">Reset Your Password</h2>
          <p style="color:#374151">Hi ${user.name},</p>
          <p style="color:#374151">Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
          <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email. Your password won't change.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">OpenDonate Platform</p>
        </div>
      `
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailBody)
    });

    if (!resendRes.ok) {
      // Rollback token if email fails
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save({ validateBeforeSave: false });
      return next(new AppError('Failed to send reset email. Please try again.', 500));
    }

    return res.status(200).json({
      success: true,
      message: 'If this email exists, a reset link has been sent.'
    });
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, email, password } = req.body;

    if (!token || !email || !password) {
      return next(new AppError('Token, email, and new password are required', 400));
    }

    if (password.length < 8) {
      return next(new AppError('Password must be at least 8 characters', 400));
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');

    const user = await User.findOne({
      email: normalizedEmail,
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new AppError('Invalid or expired reset link. Please request a new one.', 400));
    }

    user.password = String(password);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login.'
    });
  } catch (error) {
    return next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    return res.status(200).json({
      success: true,
      message: 'Profile fetched successfully',
      data: { user: buildUserPayload(user) }
    });
  } catch (error) {
    return next(error);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const updates = {};
    if (typeof req.body.name === 'string') updates.name = req.body.name.trim();
    if (typeof req.body.mobileNumber === 'string') updates.mobileNumber = req.body.mobileNumber.trim();
    if (typeof req.body.profilePicture === 'string') updates.profilePicture = req.body.profilePicture.trim();

    if (!Object.keys(updates).length) {
      return next(new AppError('No valid fields provided for update', 400));
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: buildUserPayload(user) }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, forgotPassword, resetPassword, getMyProfile, updateMyProfile };
