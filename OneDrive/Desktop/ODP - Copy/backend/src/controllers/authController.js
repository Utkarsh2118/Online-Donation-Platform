const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const buildUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isBlocked: user.isBlocked,
  mobileNumber: user.mobileNumber,
  profilePicture: user.profilePicture,
  createdAt: user.createdAt
});

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'user'
    });

    const token = generateToken({
      id: user._id,
      role: user.role
    });

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
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Account is blocked. Please contact support.'
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken({
      id: user._id,
      role: user.role
    });

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
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
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
    const { name, mobileNumber, profilePicture } = req.body;
    const updates = {};

    if (typeof name === 'string') {
      const trimmedName = name.trim();
      if (trimmedName.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Name must be at least 2 characters'
        });
      }

      updates.name = trimmedName;
    }

    if (typeof mobileNumber === 'string') {
      updates.mobileNumber = mobileNumber.trim();
    }

    if (typeof profilePicture === 'string') {
      updates.profilePicture = profilePicture.trim();
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
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

const seedAdmin = async (req, res, next) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Platform Admin';

    if (!adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: 'ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment'
      });
    }

    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase().trim() });

    if (existingAdmin) {
      return res.status(200).json({
        success: true,
        message: 'Admin already exists',
        data: {
          adminId: existingAdmin._id,
          email: existingAdmin.email
        }
      });
    }

    const adminUser = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin'
    });

    return res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        adminId: adminUser._id,
        email: adminUser.email
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
  updateMyProfile,
  seedAdmin
};
