const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');

const getCampaigns = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const query = { status: 'active' };

    if (search) {
      query.$text = { $search: search };
    }

    const [campaigns, total] = await Promise.all([
      Campaign.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean(),
      Campaign.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Campaign list fetched successfully',
      data: {
        campaigns,
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

const getCampaignById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }

    const campaign = await Campaign.findById(id).select('-__v').lean();

    if (!campaign || campaign.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Campaign details fetched successfully',
      data: { campaign }
    });
  } catch (error) {
    return next(error);
  }
};

const getAllCampaignsForAdmin = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();

    const query = {};

    if (search) {
      query.$text = { $search: search };
    }

    if (status && ['active', 'completed', 'paused'].includes(status)) {
      query.status = status;
    }

    const [campaigns, total] = await Promise.all([
      Campaign.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email role')
        .select('-__v')
        .lean(),
      Campaign.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Admin campaign list fetched successfully',
      data: {
        campaigns,
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

const createCampaign = async (req, res, next) => {
  try {
    const { title, description, goalAmount, status, coverImage } = req.body;

    if (!title || !description || !goalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and goalAmount are required'
      });
    }

    const campaign = await Campaign.create({
      title,
      description,
      goalAmount,
      status: status || 'active',
      coverImage: coverImage || '',
      createdBy: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: { campaign }
    });
  } catch (error) {
    return next(error);
  }
};

const updateCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const updatableFields = ['title', 'description', 'goalAmount', 'status', 'coverImage'];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        campaign[field] = req.body[field];
      }
    });

    if (campaign.goalAmount < campaign.raisedAmount) {
      return res.status(400).json({
        success: false,
        message: 'Goal amount cannot be less than raised amount'
      });
    }

    await campaign.save();

    return res.status(200).json({
      success: true,
      message: 'Campaign updated successfully',
      data: { campaign }
    });
  } catch (error) {
    return next(error);
  }
};

const deleteCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }

    const campaign = await Campaign.findByIdAndDelete(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCampaigns,
  getCampaignById,
  getAllCampaignsForAdmin,
  createCampaign,
  updateCampaign,
  deleteCampaign
};
