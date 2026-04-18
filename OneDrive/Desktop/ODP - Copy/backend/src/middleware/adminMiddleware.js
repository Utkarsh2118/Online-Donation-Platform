const AppError = require('../utils/AppError');

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Forbidden: admin access required', 403));
  }

  next();
};

module.exports = {
  requireAdmin
};
