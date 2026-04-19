const AppError = require('../utils/AppError');

const ROLE_HIERARCHY = {
  user: 0,
  support: 1,
  finance: 2,
  admin: 3,
  super_admin: 4
};

const getRoleRank = (role) => ROLE_HIERARCHY[String(role || '').toLowerCase()] ?? -1;

const requireRoles = (...allowedRoles) => (req, res, next) => {
  const currentRole = String(req.user?.role || '').toLowerCase();

  if (!allowedRoles.map((role) => String(role).toLowerCase()).includes(currentRole)) {
    return next(new AppError('Forbidden: insufficient permissions', 403));
  }

  next();
};

const requireMinimumRole = (minimumRole) => (req, res, next) => {
  const currentRank = getRoleRank(req.user?.role);
  const minimumRank = getRoleRank(minimumRole);

  if (currentRank < minimumRank) {
    return next(new AppError('Forbidden: insufficient permissions', 403));
  }

  next();
};

const requireAdmin = requireRoles('admin', 'super_admin');
const requireStaff = requireRoles('support', 'finance', 'admin', 'super_admin');
const requireFinance = requireRoles('finance', 'admin', 'super_admin');
const requireSuperAdmin = requireRoles('super_admin');

module.exports = {
  requireAdmin,
  requireFinance,
  requireMinimumRole,
  requireRoles,
  requireStaff,
  requireSuperAdmin
};
