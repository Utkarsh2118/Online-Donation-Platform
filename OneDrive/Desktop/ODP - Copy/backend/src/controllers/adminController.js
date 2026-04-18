const mongoose = require('mongoose');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');

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

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role && ['user', 'admin'].includes(role)) {
      query.role = role;
    }

    if (blocked === 'true') {
      query.isBlocked = true;
    }

    if (blocked === 'false') {
      query.isBlocked = false;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-password -__v')
        .lean(),
      User.countDocuments(query)
    ]);

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

    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin users cannot be blocked from this endpoint'
      });
    }

    user.isBlocked = true;
    await user.save();

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

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin users cannot be deleted from this endpoint'
      });
    }

    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
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
  deleteUser
};
