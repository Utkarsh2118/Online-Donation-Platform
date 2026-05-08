const express = require('express');
const {
  createDonation, verifyDonationPayment, razorpayWebhook,
  refundDonation, resendReceipt, markDonationFailed,
  getMyDonations, getCampaignDonations, getAllDonations
} = require('../controllers/donationController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const { validate, createDonationSchema, refundDonationSchema } = require('../utils/validators');

const router = express.Router();

// ── Webhook — must receive RAW body (before JSON parse middleware) ─────────
// Register in Razorpay dashboard: POST https://yourdomain.com/api/donations/webhook
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),  // override JSON middleware for this route
  razorpayWebhook
);

// ── User routes ────────────────────────────────────────────────────────────
router.post('/',               protect, validate(createDonationSchema), createDonation);
router.post('/verify',         protect, verifyDonationPayment);
router.post('/failed',         protect, markDonationFailed);
router.get('/my',              protect, getMyDonations);
router.post('/:donationId/resend-receipt', protect, resendReceipt);

// ── Admin routes ───────────────────────────────────────────────────────────
router.get('/all',             protect, isAdmin, getAllDonations);
router.post('/refund',         protect, isAdmin, validate(refundDonationSchema), refundDonation);

// ── Public ─────────────────────────────────────────────────────────────────
router.get('/campaign/:campaignId', getCampaignDonations);

module.exports = router;
