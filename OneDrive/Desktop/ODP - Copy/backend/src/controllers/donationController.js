const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');
const getRazorpayInstance = require('../config/razorpay');
const verifyRazorpaySignature = require('../utils/verifyRazorpaySignature');
const AppError = require('../utils/AppError');

const createDonation = async (req, res, next) => {
  try {
    const { campaignId, amount } = req.body;

    if (!campaignId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'campaignId and amount are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }

    const donationAmount = Number(amount);

    if (!Number.isFinite(donationAmount) || donationAmount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a number greater than or equal to 1'
      });
    }

    const campaign = await Campaign.findById(campaignId);

    if (!campaign || campaign.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found or not active'
      });
    }

    const donation = await Donation.create({
      userId: req.user.id,
      campaignId,
      amount: donationAmount,
      paymentStatus: 'created'
    });

    let order;

    try {
      const razorpay = getRazorpayInstance();
      order = await razorpay.orders.create({
        amount: Math.round(donationAmount * 100),
        currency: 'INR',
        receipt: `don_${donation._id.toString().slice(-12)}`,
        notes: {
          donationId: donation._id.toString(),
          campaignId: campaign._id.toString(),
          userId: req.user.id.toString()
        }
      });
    } catch (gatewayError) {
      donation.paymentStatus = 'failed';
      await donation.save();

      const gatewayMessage = gatewayError?.error?.description || gatewayError?.message;
      const configIssue = gatewayError?.statusCode === 401 || /auth|key/i.test(gatewayMessage || '');

      return next(
        new AppError(
          configIssue
            ? 'Payment gateway authentication failed. Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.'
            : gatewayMessage || 'Could not initialize payment gateway order. Please try again.',
          configIssue ? 500 : 502
        )
      );
    }

    donation.razorpayOrderId = order.id;
    await donation.save();

    return res.status(201).json({
      success: true,
      message: 'Donation order created successfully',
      data: {
        donation: {
          id: donation._id,
          userId: donation.userId,
          campaignId: donation.campaignId,
          amount: donation.amount,
          razorpayOrderId: donation.razorpayOrderId,
          paymentStatus: donation.paymentStatus,
          createdAt: donation.createdAt
        },
        order,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    return next(error);
  }
};

const verifyDonationPayment = async (req, res, next) => {
  try {
    const {
      donationId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature
    } = req.body;

    if (!donationId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'donationId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(donationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid donation ID'
      });
    }

    const donation = await Donation.findById(donationId);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    if (donation.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: this donation does not belong to current user'
      });
    }

    if (donation.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Donation is already marked as paid',
        data: { donationId: donation._id }
      });
    }

    const signatureIsValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      secret: process.env.RAZORPAY_KEY_SECRET
    });

    if (!signatureIsValid) {
      donation.paymentStatus = 'failed';
      donation.razorpayOrderId = razorpayOrderId;
      donation.razorpayPaymentId = razorpayPaymentId;
      donation.razorpaySignature = razorpaySignature;
      await donation.save();

      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed'
      });
    }

    donation.paymentStatus = 'paid';
    donation.razorpayOrderId = razorpayOrderId;
    donation.razorpayPaymentId = razorpayPaymentId;
    donation.razorpaySignature = razorpaySignature;
    await donation.save();

    const campaign = await Campaign.findByIdAndUpdate(
      donation.campaignId,
      { $inc: { raisedAmount: donation.amount } },
      { new: true }
    );

    if (campaign && campaign.raisedAmount >= campaign.goalAmount && campaign.status !== 'completed') {
      campaign.status = 'completed';
      await campaign.save();
    }

    const io = req.app.get('io');
    if (io && campaign) {
      io.emit('donation:updated', {
        campaignId: campaign._id,
        raisedAmount: campaign.raisedAmount,
        goalAmount: campaign.goalAmount,
        paymentStatus: donation.paymentStatus
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and donation completed',
      data: {
        donation: {
          id: donation._id,
          paymentStatus: donation.paymentStatus,
          razorpayOrderId: donation.razorpayOrderId,
          razorpayPaymentId: donation.razorpayPaymentId
        },
        campaign: campaign
          ? {
              id: campaign._id,
              raisedAmount: campaign.raisedAmount,
              goalAmount: campaign.goalAmount,
              status: campaign.status
            }
          : null
      }
    });
  } catch (error) {
    return next(error);
  }
};

const markDonationFailed = async (req, res, next) => {
  try {
    const { donationId, razorpayOrderId, razorpayPaymentId } = req.body;

    if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid donationId is required'
      });
    }

    const donation = await Donation.findById(donationId);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    if (donation.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: this donation does not belong to current user'
      });
    }

    if (donation.paymentStatus !== 'paid') {
      donation.paymentStatus = 'failed';
      if (razorpayOrderId) {
        donation.razorpayOrderId = razorpayOrderId;
      }
      if (razorpayPaymentId) {
        donation.razorpayPaymentId = razorpayPaymentId;
      }
      await donation.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Donation marked as failed'
    });
  } catch (error) {
    return next(error);
  }
};

const getMyDonations = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };

    const [donations, total] = await Promise.all([
      Donation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('campaignId', 'title status goalAmount raisedAmount')
        .select('-__v')
        .lean(),
      Donation.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Donation history fetched successfully',
      data: {
        donations,
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

const getCampaignDonations = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }

    const campaign = await Campaign.findById(campaignId).select('title status');

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const query = { campaignId, paymentStatus: 'paid' };

    const [donations, total] = await Promise.all([
      Donation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name')
        .select('userId amount paymentStatus createdAt')
        .lean(),
      Donation.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Campaign donations fetched successfully',
      data: {
        campaign,
        donations,
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

const getAllDonations = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const paymentStatus = (req.query.paymentStatus || '').trim();

    const query = {};
    if (paymentStatus && ['created', 'paid', 'failed'].includes(paymentStatus)) {
      query.paymentStatus = paymentStatus;
    }

    const [donations, total] = await Promise.all([
      Donation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .populate('campaignId', 'title status')
        .select('-__v')
        .lean(),
      Donation.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: 'All donations fetched successfully',
      data: {
        donations,
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
  createDonation,
  verifyDonationPayment,
  markDonationFailed,
  getMyDonations,
  getCampaignDonations,
  getAllDonations
};
