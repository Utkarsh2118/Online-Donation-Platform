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
      data: {
        token,
        user: buildUserPayload(user)
      }
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
      data: {
        token,
        user: buildUserPayload(user)
      }
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
      data: {
        user: buildUserPayload(user)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const updates = {};

    if (typeof req.body.name === 'string') {
      updates.name = req.body.name.trim();
    }

    if (typeof req.body.mobileNumber === 'string') {
      updates.mobileNumber = req.body.mobileNumber.trim();
    }

    if (typeof req.body.profilePicture === 'string') {
      updates.profilePicture = req.body.profilePicture.trim();
    }

    if (!Object.keys(updates).length) {
      return next(new AppError('No valid fields provided for update', 400));
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: buildUserPayload(user)
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  getMyProfile,
  updateMyProfile
};
