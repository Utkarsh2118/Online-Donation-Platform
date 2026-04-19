const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const recordAuditLog = require('../utils/auditLogger');

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
    const deleted = String(req.query.deleted || '').toLowerCase() === 'true';
    const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';

    const query = {};

    if (search) {
      query.$text = { $search: search };
    }

    if (status && ['active', 'completed', 'paused'].includes(status)) {
      query.status = status;
    }

    let campaignsQuery = Campaign.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email role')
      .select('-__v');

    if (deleted) {
      campaignsQuery = campaignsQuery.onlyDeleted();
    } else if (includeDeleted) {
      campaignsQuery = campaignsQuery.withDeleted();
    }

    let countQuery = Campaign.countDocuments(query);

    if (deleted) {
      countQuery = countQuery.onlyDeleted();
    } else if (includeDeleted) {
      countQuery = countQuery.withDeleted();
    }

    const [campaigns, total] = await Promise.all([campaignsQuery.lean(), countQuery]);

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

    await recordAuditLog({
      req,
      action: 'campaign.create',
      entityType: 'campaign',
      entityId: campaign._id,
      entityName: campaign.title,
      metadata: { goalAmount: campaign.goalAmount, status: campaign.status }
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

    await recordAuditLog({
      req,
      action: 'campaign.update',
      entityType: 'campaign',
      entityId: campaign._id,
      entityName: campaign.title,
      metadata: {
        goalAmount: campaign.goalAmount,
        status: campaign.status,
        raisedAmount: campaign.raisedAmount
      }
    });

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

    const campaign = await Campaign.findOne({ _id: id }).withDeleted();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (campaign.isDeleted) {
      return res.status(200).json({
        success: true,
        message: 'Campaign is already archived'
      });
    }

    campaign.isDeleted = true;
    campaign.deletedAt = new Date();
    campaign.deletedBy = req.user.id;
    campaign.deletionReason = String(req.body.reason || '').trim();
    await campaign.save();

    await recordAuditLog({
      req,
      action: 'campaign.delete',
      entityType: 'campaign',
      entityId: campaign._id,
      entityName: campaign.title,
      metadata: { reason: campaign.deletionReason, status: campaign.status }
    });

    return res.status(200).json({
      success: true,
      message: 'Campaign archived successfully'
    });
  } catch (error) {
    return next(error);
  }
};

const restoreCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }

    const campaign = await Campaign.findOne({ _id: id }).withDeleted();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (!campaign.isDeleted) {
      return res.status(200).json({
        success: true,
        message: 'Campaign is already active'
      });
    }

    campaign.isDeleted = false;
    campaign.deletedAt = null;
    campaign.deletedBy = null;
    campaign.deletionReason = '';
    await campaign.save();

    await recordAuditLog({
      req,
      action: 'campaign.restore',
      entityType: 'campaign',
      entityId: campaign._id,
      entityName: campaign.title,
      metadata: { status: campaign.status, goalAmount: campaign.goalAmount }
    });

    return res.status(200).json({
      success: true,
      message: 'Campaign restored successfully'
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
  deleteCampaign,
  restoreCampaign
};
