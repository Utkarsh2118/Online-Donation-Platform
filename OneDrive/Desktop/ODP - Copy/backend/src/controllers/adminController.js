const mongoose = require('mongoose');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const AuditLog = require('../models/AuditLog');
const recordAuditLog = require('../utils/auditLogger');

const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      blockedUsers,
      totalCampaigns,
      activeCampaigns,
      totalDonations,
      paidDonationStats,
      recentDonations,
      recentUsers
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', isBlocked: true }),
      Campaign.countDocuments(),
      Campaign.countDocuments({ status: 'active' }),
      Donation.countDocuments(),
      Donation.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
      ]),
      Donation.find({ paymentStatus: 'paid' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .populate('campaignId', 'title')
        .select('amount paymentStatus createdAt')
        .lean(),
      User.find({ role: 'user' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email isBlocked createdAt')
        .lean()
    ]);

    const totalRaisedAmount = paidDonationStats[0]?.totalAmount || 0;

    return res.status(200).json({
      success: true,
      message: 'Admin dashboard stats fetched successfully',
      data: {
        stats: {
          totalUsers,
          blockedUsers,
          totalCampaigns,
          activeCampaigns,
          totalDonations,
          totalRaisedAmount
        },
        recentDonations,
        recentUsers
      }
    });
  } catch (error) {
    return next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const role = (req.query.role || '').trim();
    const blocked = req.query.blocked;
    const deleted = String(req.query.deleted || '').toLowerCase() === 'true';
    const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role && ['user', 'support', 'finance', 'admin', 'super_admin'].includes(role)) {
      query.role = role;
    }

    if (blocked === 'true') {
      query.isBlocked = true;
    }

    if (blocked === 'false') {
      query.isBlocked = false;
    }

    let usersQuery = User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-password -__v');

    if (deleted) {
      usersQuery = usersQuery.onlyDeleted();
    } else if (includeDeleted) {
      usersQuery = usersQuery.withDeleted();
    }

    let countQuery = User.countDocuments(query);

    if (deleted) {
      countQuery = countQuery.onlyDeleted();
    } else if (includeDeleted) {
      countQuery = countQuery.withDeleted();
    }

    const [users, total] = await Promise.all([usersQuery.lean(), countQuery]);

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

const blockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin users cannot be blocked from this endpoint'
      });
    }

    if (String(user._id) === String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot block your own account'
      });
    }

    user.isBlocked = true;
    await user.save();

    await recordAuditLog({
      req,
      action: 'user.block',
      entityType: 'user',
      entityId: user._id,
      entityName: user.name,
      metadata: { email: user.email, role: user.role }
    });

    return res.status(200).json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    return next(error);
  }
};

const unblockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isBlocked = false;
    await user.save();

    await recordAuditLog({
      req,
      action: 'user.unblock',
      entityType: 'user',
      entityId: user._id,
      entityName: user.name,
      metadata: { email: user.email, role: user.role }
    });

    return res.status(200).json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findOne({ _id: userId }).withDeleted();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (String(user._id) === String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin users can only be deleted by another super admin'
      });
    }

    if (user.isDeleted) {
      return res.status(200).json({
        success: true,
        message: 'User is already archived'
      });
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = req.user.id;
    user.deletionReason = String(req.body.reason || '').trim();
    await user.save();

    await recordAuditLog({
      req,
      action: 'user.delete',
      entityType: 'user',
      entityId: user._id,
      entityName: user.name,
      metadata: { email: user.email, role: user.role, reason: user.deletionReason }
    });

    return res.status(200).json({
      success: true,
      message: 'User archived successfully'
    });
  } catch (error) {
    return next(error);
  }
};

const restoreUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findOne({ _id: userId }).withDeleted();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isDeleted) {
      return res.status(200).json({
        success: true,
        message: 'User is already active'
      });
    }

    user.isDeleted = false;
    user.deletedAt = null;
    user.deletedBy = null;
    user.deletionReason = '';
    await user.save();

    await recordAuditLog({
      req,
      action: 'user.restore',
      entityType: 'user',
      entityId: user._id,
      entityName: user.name,
      metadata: { email: user.email, role: user.role }
    });

    return res.status(200).json({
      success: true,
      message: 'User restored successfully'
    });
  } catch (error) {
    return next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const skip = (page - 1) * limit;
    const action = (req.query.action || '').trim();
    const entityType = (req.query.entityType || '').trim();
    const actorRole = (req.query.actorRole || '').trim();
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();

    const query = {};

    if (action) {
      query.action = action;
    }

    if (entityType) {
      query.entityType = entityType;
    }

    if (actorRole) {
      query.actorRole = actorRole;
    }

    if (status && ['success', 'failure'].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { action: { $regex: search, $options: 'i' } },
        { entityName: { $regex: search, $options: 'i' } },
        { entityType: { $regex: search, $options: 'i' } }
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name email role')
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Audit logs fetched successfully',
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  blockUser,
  unblockUser,
  deleteUser,
  restoreUser,
  getAuditLogs
};
