const crypto = require('crypto');
const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const getRazorpayInstance = require('../config/razorpay');
const verifyRazorpaySignature = require('../utils/verifyRazorpaySignature');
const AppError = require('../utils/AppError');
const { generateReceiptPDF } = require('../utils/generateReceipt');
const {
  sendEmail,
  sendEmailWithAttachment,
  donationReceiptTemplate,
  refundConfirmationTemplate
} = require('../utils/sendEmail');

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Mark a donation as paid, update campaign raisedAmount, emit socket event,
 * and send receipt email. Used by both the client-side verify endpoint and
 * the Razorpay webhook so the logic lives in one place.
 */
const confirmDonationPaid = async ({ donation, razorpayOrderId, razorpayPaymentId, razorpaySignature, io }) => {
  donation.paymentStatus = 'paid';
  donation.razorpayOrderId  = razorpayOrderId;
  donation.razorpayPaymentId = razorpayPaymentId;
  if (razorpaySignature) donation.razorpaySignature = razorpaySignature;
  await donation.save();

  // Update campaign raised amount
  const campaign = await Campaign.findByIdAndUpdate(
    donation.campaignId,
    { $inc: { raisedAmount: donation.amount } },
    { new: true }
  );

  if (campaign && campaign.raisedAmount >= campaign.goalAmount && campaign.status !== 'completed') {
    campaign.status = 'completed';
    await campaign.save();
  }

  // Real-time socket broadcast
  if (io && campaign) {
    io.emit('donation:updated', {
      campaignId: campaign._id,
      raisedAmount: campaign.raisedAmount,
      goalAmount: campaign.goalAmount
    });
  }

  // Send receipt email asynchronously — never block the response
  sendReceiptEmail(donation).catch(err =>
    console.error('[receipt] email failed for donation', donation._id, err.message)
  );

  return campaign;
};

/**
 * Build and email a PDF receipt to the donor.
 */
const sendReceiptEmail = async (donation) => {
  const populatedDonation = await Donation.findById(donation._id)
    .populate('userId', 'name email')
    .populate('campaignId', 'title')
    .lean();

  if (!populatedDonation?.userId?.email) return;

  const { isAnonymous } = populatedDonation;
  const donorName  = populatedDonation.userId.name;
  const donorEmail = populatedDonation.userId.email;
  const campaignTitle = populatedDonation.campaignId?.title || 'Campaign';

  const pdfBuffer = await generateReceiptPDF({
    donorName,
    donorEmail,
    campaignTitle,
    amount:           populatedDonation.amount,
    donationId:       String(populatedDonation._id),
    razorpayPaymentId: populatedDonation.razorpayPaymentId,
    paidAt:           populatedDonation.updatedAt,
    isAnonymous
  });

  await sendEmailWithAttachment({
    to: donorEmail,
    subject: `Your donation receipt — ${campaignTitle}`,
    html: donationReceiptTemplate(
      isAnonymous ? 'Donor' : donorName,
      campaignTitle,
      populatedDonation.amount,
      String(populatedDonation._id),
      populatedDonation.updatedAt
    ),
    attachment: {
      filename: `receipt-${String(populatedDonation._id).slice(-10)}.pdf`,
      buffer: pdfBuffer
    }
  });

  // Mark receipt as sent
  await Donation.findByIdAndUpdate(donation._id, { receiptSentAt: new Date() });
};

// ── Create donation order ─────────────────────────────────────────────────
const createDonation = async (req, res, next) => {
  try {
    const { campaignId, amount, isAnonymous = false } = req.body;
    // Validation already done by Zod middleware

    const campaign = await Campaign.findById(campaignId);
    if (!campaign || campaign.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Campaign not found or not active' });
    }

    const donation = await Donation.create({
      userId: req.user.id,
      campaignId,
      amount: Number(amount),
      isAnonymous,
      paymentStatus: 'created'
    });

    let order;
    try {
      const razorpay = getRazorpayInstance();
      order = await razorpay.orders.create({
        amount: Math.round(Number(amount) * 100),
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
      return next(new AppError(
        configIssue
          ? 'Payment gateway authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
          : gatewayMessage || 'Could not initialise payment. Please try again.',
        configIssue ? 500 : 502
      ));
    }

    donation.razorpayOrderId = order.id;
    await donation.save();

    return res.status(201).json({
      success: true,
      message: 'Donation order created',
      data: {
        donation: {
          id: donation._id,
          amount: donation.amount,
          razorpayOrderId: donation.razorpayOrderId,
          paymentStatus: donation.paymentStatus,
          isAnonymous: donation.isAnonymous
        },
        order,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    return next(error);
  }
};

// ── Client-side payment verification ─────────────────────────────────────
// Kept as a fallback — the webhook is the authoritative source.
const verifyDonationPayment = async (req, res, next) => {
  try {
    const {
      donationId,
      razorpay_order_id:   razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature:  razorpaySignature
    } = req.body;

    if (!donationId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'donationId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(donationId)) {
      return res.status(400).json({ success: false, message: 'Invalid donation ID' });
    }

    const donation = await Donation.findById(donationId);
    if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });

    if (donation.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: donation does not belong to you' });
    }

    // Already confirmed by webhook — just return success
    if (donation.paymentStatus === 'paid') {
      return res.status(200).json({ success: true, message: 'Payment already confirmed', data: { donationId: donation._id } });
    }

    const signatureIsValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      secret: process.env.RAZORPAY_KEY_SECRET
    });

    if (!signatureIsValid) {
      donation.paymentStatus = 'failed';
      donation.razorpayOrderId  = razorpayOrderId;
      donation.razorpayPaymentId = razorpayPaymentId;
      await donation.save();
      return res.status(400).json({ success: false, message: 'Payment signature verification failed' });
    }

    const io = req.app.get('io');
    const campaign = await confirmDonationPaid({ donation, razorpayOrderId, razorpayPaymentId, razorpaySignature, io });

    return res.status(200).json({
      success: true,
      message: 'Payment verified and donation completed',
      data: {
        donation: { id: donation._id, paymentStatus: 'paid', razorpayPaymentId },
        campaign: campaign ? { id: campaign._id, raisedAmount: campaign.raisedAmount, goalAmount: campaign.goalAmount, status: campaign.status } : null
      }
    });
  } catch (error) {
    return next(error);
  }
};

// ── Razorpay Webhook ──────────────────────────────────────────────────────
// This is the AUTHORITATIVE payment confirmation path.
// Register this URL in your Razorpay dashboard:  POST /api/donations/webhook
// Events to subscribe: payment.captured, refund.processed
const razorpayWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Verify webhook signature
  const receivedSignature = req.headers['x-razorpay-signature'];
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body) // raw Buffer — must NOT be parsed JSON
    .digest('hex');

  if (receivedSignature !== expectedSignature) {
    console.warn('[webhook] Invalid Razorpay signature');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }

  const { event: eventName, payload } = event;
  console.log('[webhook] Received event:', eventName);

  try {
    // ── payment.captured ───────────────────────────────────────────
    if (eventName === 'payment.captured') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;

      const donation = await Donation.findOne({ razorpayOrderId: orderId });
      if (!donation) {
        console.warn('[webhook] No donation found for order:', orderId);
        return res.status(200).json({ received: true }); // Acknowledge to Razorpay
      }

      if (donation.paymentStatus !== 'paid') {
        const io = require('../server').io; // lazy require to avoid circular
        await confirmDonationPaid({
          donation,
          razorpayOrderId:  orderId,
          razorpayPaymentId: payment.id,
          razorpaySignature: null, // not available in webhook
          io
        });
        console.log('[webhook] Donation confirmed:', donation._id.toString());
      }
    }

    // ── refund.processed ───────────────────────────────────────────
    if (eventName === 'refund.processed') {
      const refund = payload.refund.entity;
      const paymentId = refund.payment_id;

      const donation = await Donation.findOne({ razorpayPaymentId: paymentId });
      if (donation && donation.paymentStatus !== 'refunded') {
        donation.paymentStatus = 'refunded';
        donation.refundId      = refund.id;
        donation.refundAmount  = refund.amount / 100;
        donation.refundedAt    = new Date();
        await donation.save();

        // Decrement campaign raised amount
        await Campaign.findByIdAndUpdate(donation.campaignId, {
          $inc: { raisedAmount: -donation.refundAmount }
        });

        // Notify donor
        const user = await User.findById(donation.userId).select('name email');
        const campaign = await Campaign.findById(donation.campaignId).select('title');
        if (user?.email) {
          sendEmail({
            to: user.email,
            subject: 'Refund Confirmed — OpenDonate',
            html: refundConfirmationTemplate(user.name, campaign?.title || 'Campaign', donation.refundAmount, refund.id)
          }).catch(err => console.error('[webhook] refund email failed:', err.message));
        }
      }
    }
  } catch (err) {
    console.error('[webhook] Processing error:', err.message);
    // Still return 200 so Razorpay doesn't retry
  }

  return res.status(200).json({ received: true });
};

// ── Refund (admin-initiated) ──────────────────────────────────────────────
const refundDonation = async (req, res, next) => {
  try {
    const { donationId, reason } = req.body;

    const donation = await Donation.findById(donationId)
      .populate('userId', 'name email')
      .populate('campaignId', 'title');

    if (!donation) return next(new AppError('Donation not found', 404));
    if (donation.paymentStatus !== 'paid') {
      return next(new AppError('Only paid donations can be refunded', 400));
    }
    if (donation.paymentStatus === 'refunded') {
      return next(new AppError('Donation already refunded', 400));
    }

    if (!donation.razorpayPaymentId) {
      return next(new AppError('No Razorpay payment ID found on this donation', 400));
    }

    const razorpay = getRazorpayInstance();
    const refund = await razorpay.payments.refund(donation.razorpayPaymentId, {
      amount: Math.round(donation.amount * 100),
      notes: { reason: reason || 'Admin-initiated refund', donationId: String(donation._id) }
    });

    // Update immediately — webhook will also fire but the idempotency check handles it
    donation.paymentStatus = 'refunded';
    donation.refundId      = refund.id;
    donation.refundAmount  = refund.amount / 100;
    donation.refundedAt    = new Date();
    donation.refundReason  = reason || '';
    await donation.save();

    await Campaign.findByIdAndUpdate(donation.campaignId, {
      $inc: { raisedAmount: -donation.refundAmount }
    });

    // Notify donor
    if (donation.userId?.email) {
      sendEmail({
        to: donation.userId.email,
        subject: 'Refund Processed — OpenDonate',
        html: refundConfirmationTemplate(
          donation.userId.name,
          donation.campaignId?.title || 'Campaign',
          donation.refundAmount,
          refund.id
        )
      }).catch(err => console.error('[refund] email failed:', err.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      data: { refundId: refund.id, refundAmount: donation.refundAmount }
    });
  } catch (error) {
    return next(error);
  }
};

// ── Resend receipt ────────────────────────────────────────────────────────
const resendReceipt = async (req, res, next) => {
  try {
    const { donationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(donationId)) {
      return next(new AppError('Invalid donation ID', 400));
    }

    const donation = await Donation.findById(donationId);
    if (!donation) return next(new AppError('Donation not found', 404));

    // Users can only resend their own receipts; admins can resend any
    if (donation.userId.toString() !== req.user.id.toString() && !['admin', 'super_admin'].includes(req.user.role)) {
      return next(new AppError('Forbidden', 403));
    }

    if (donation.paymentStatus !== 'paid') {
      return next(new AppError('Receipt is only available for paid donations', 400));
    }

    await sendReceiptEmail(donation);

    return res.status(200).json({ success: true, message: 'Receipt sent to your email address' });
  } catch (error) {
    return next(error);
  }
};

// ── Mark failed (client-side) ────────────────────────────────────────────
const markDonationFailed = async (req, res, next) => {
  try {
    const { donationId, razorpayOrderId, razorpayPaymentId } = req.body;

    if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
      return res.status(400).json({ success: false, message: 'Valid donationId is required' });
    }

    const donation = await Donation.findById(donationId);
    if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });

    if (donation.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (donation.paymentStatus !== 'paid') {
      donation.paymentStatus = 'failed';
      if (razorpayOrderId) donation.razorpayOrderId = razorpayOrderId;
      if (razorpayPaymentId) donation.razorpayPaymentId = razorpayPaymentId;
      await donation.save();
    }

    return res.status(200).json({ success: true, message: 'Donation marked as failed' });
  } catch (error) {
    return next(error);
  }
};

// ── Query endpoints ───────────────────────────────────────────────────────
const getMyDonations = async (req, res, next) => {
  try {
    const page  = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip  = (page - 1) * limit;

    const [donations, total] = await Promise.all([
      Donation.find({ userId: req.user.id })
        .sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('campaignId', 'title status goalAmount raisedAmount')
        .select('-__v').lean(),
      Donation.countDocuments({ userId: req.user.id })
    ]);

    return res.status(200).json({
      success: true,
      data: { donations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }
    });
  } catch (error) { return next(error); }
};

const getCampaignDonations = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const page  = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip  = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
    }

    const campaign = await Campaign.findById(campaignId).select('title status');
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const [donations, total] = await Promise.all([
      Donation.find({ campaignId, paymentStatus: 'paid' })
        .sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('userId', 'name')
        .select('userId amount isAnonymous createdAt').lean(),
      Donation.countDocuments({ campaignId, paymentStatus: 'paid' })
    ]);

    // Mask donor name for anonymous donations
    const sanitized = donations.map(d => ({
      ...d,
      userId: d.isAnonymous ? { name: 'Anonymous' } : d.userId
    }));

    return res.status(200).json({
      success: true,
      data: { campaign, donations: sanitized, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }
    });
  } catch (error) { return next(error); }
};

const getAllDonations = async (req, res, next) => {
  try {
    const page  = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip  = (page - 1) * limit;
    const paymentStatus = (req.query.paymentStatus || '').trim();

    const query = {};
    if (paymentStatus && ['created', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
      query.paymentStatus = paymentStatus;
    }

    const [donations, total] = await Promise.all([
      Donation.find(query)
        .sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('userId', 'name email')
        .populate('campaignId', 'title status')
        .select('-__v').lean(),
      Donation.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: { donations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }
    });
  } catch (error) { return next(error); }
};

module.exports = {
  createDonation,
  verifyDonationPayment,
  razorpayWebhook,
  refundDonation,
  resendReceipt,
  markDonationFailed,
  getMyDonations,
  getCampaignDonations,
  getAllDonations
};
