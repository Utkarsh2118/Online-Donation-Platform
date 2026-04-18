const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const protect = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return next(new AppError('JWT secret is not configured', 500));
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Unauthorized: token missing', 401));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError('Unauthorized: user not found', 401));
    }

    if (user.isBlocked) {
      return next(new AppError('Account is blocked. Please contact support.', 403));
    }

    req.user = {
      id: user._id,
      role: user.role,
      email: user.email,
      name: user.name
    };

    next();
  } catch (error) {
    return next(new AppError('Unauthorized: invalid or expired token', 401));
  }
};

module.exports = {
  protect
};
